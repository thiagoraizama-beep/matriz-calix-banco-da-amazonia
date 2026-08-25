import { query } from "../config/database.js";
import { getSheetsClient } from "../config/googleSheets.js";
import { listCreativesByCampanha } from "./creativesService.js";
import { getCampanhaById } from "./campanhasService.js";
import { agruparCreativosPorPlataforma } from "../utils/agruparCreativosPorPlataforma.js";
import {
  objetivoPorTiposCompra, listaNumerada, formatarData, nomeAbaValido, urlThumbnail,
  urlComDownloadForcado, ROW_HEIGHT_PT, THUMB_WIDTH_PX,
} from "./creativesExportService.js";
import { gerarTokenDownload } from "./authService.js";
import { getExportConfig, resolverColunasDaAba } from "./creativesColumnsConfigService.js";

// Sincronizacao de uma campanha com uma planilha Google Sheets -- direcao
// inversa de campanha_sheets (que LE performance de fora pra dentro): aqui o
// sistema ESCREVE criativos cadastrados numa planilha do usuario. Selecao e
// MANUAL -- so os criativos marcados em campanha_sheets_sync_items entram na
// planilha (ver setSheetSyncSelecao). Depois de marcado, qualquer edicao no
// criativo (status, orcamento etc) dispara recalculo automatico da aba --
// so a entrada/saida da planilha exige acao explicita do usuario.
// Recalcula a planilha inteira a cada chamada (nunca incremental) -- mais
// simples e correto por construcao, dado o volume baixo (dezenas de
// criativos marcados por campanha).

export async function getCampanhaSheetSyncConfig(campanhaId) {
  const { rows } = await query("SELECT * FROM campanha_sheets_sync WHERE campanha_id = $1", [campanhaId]);
  return rows[0] || null;
}

export async function upsertCampanhaSheetSync(campanhaId, spreadsheetId) {
  const { rows } = await query(
    `INSERT INTO campanha_sheets_sync (campanha_id, spreadsheet_id)
     VALUES ($1, $2)
     ON CONFLICT (campanha_id) DO UPDATE SET spreadsheet_id = $2
     RETURNING *`,
    [campanhaId, spreadsheetId]
  );
  return rows[0];
}

export async function deleteCampanhaSheetSync(campanhaId) {
  await query("DELETE FROM campanha_sheets_sync WHERE campanha_id = $1", [campanhaId]);
}

export async function getSheetSyncSelecao(campanhaId) {
  const { rows } = await query(
    "SELECT creative_id FROM campanha_sheets_sync_items WHERE campanha_id = $1",
    [campanhaId]
  );
  return rows.map((r) => r.creative_id);
}

// Recebe a lista final de creative_id marcados (vinda do modal "Gerar
// planilha") e reconcilia com o que ja estava salvo: insere os novos,
// remove os desmarcados. Criativo desmarcado sai da planilha na proxima
// sincronizacao (nao aparece mais em nenhuma aba).
export async function setSheetSyncSelecao(campanhaId, creativeIds) {
  const idsUnicos = [...new Set((creativeIds || []).map(Number).filter(Number.isFinite))];

  await query("DELETE FROM campanha_sheets_sync_items WHERE campanha_id = $1 AND creative_id != ALL($2)", [
    campanhaId,
    idsUnicos.length ? idsUnicos : [0],
  ]);

  if (idsUnicos.length) {
    const values = idsUnicos.map((_, i) => `($1, $${i + 2})`).join(", ");
    await query(
      `INSERT INTO campanha_sheets_sync_items (campanha_id, creative_id)
       VALUES ${values}
       ON CONFLICT (campanha_id, creative_id) DO NOTHING`,
      [campanhaId, ...idsUnicos]
    );
  }

  return idsUnicos;
}

// Mesmo texto/formula por celula que o Excel produz como VALOR, mas aqui em
// formato de array de arrays (linha por linha) pra values.update. peca usa
// =IMAGE() quando ha midia -- precisa de valueInputOption "USER_ENTERED"
// pra ser interpretada como formula, nao texto literal.
// Backend e frontend ficam no MESMO dominio em producao (vercel.json roteia
// /api/* pro backend) -- reaproveita FRONTEND_URL (ja configurada na Vercel)
// em vez de exigir uma env var propria so pra isso.
const BACKEND_URL = process.env.FRONTEND_URL || "http://localhost:4000";

function valoresDaLinha(c, colunas) {
  const temUnicoFormatoSearch = Array.isArray(c.formato) && c.formato.length === 1 && c.formato[0] === "Search";
  const thumbUrl = urlThumbnail(c.cloudinary_url, c.tipo_midia);

  const mapa = {
    plataforma: c.plataforma || "",
    dataInclusao: formatarData(c.criado_em),
    titulo: c.titulo || c.nome || "",
    campaignName: c.campanha || "",
    adGroup: c.conjunto || "",
    adName: c.ad_name || "",
    formato: Array.isArray(c.formato) ? c.formato.join(", ") : "",
    legenda: c.descricao || "",
    descricao: c.observacoes || "",
    // Mesma regra do Excel (creativesExportService.js): varios arquivos ->
    // link pro zip com token proprio (sem sessao); arquivo unico -> URL do
    // Cloudinary com download forcado, senao abre so a previa no navegador.
    linkPeca: Number(c.arquivos_extras) > 0
      ? `${BACKEND_URL}/api/download/creatives/${c.id}/files/zip?token=${gerarTokenDownload(c.id)}`
      : urlComDownloadForcado(c.link_postagem || c.cloudinary_url || ""),
    peca: temUnicoFormatoSearch ? "Rede de Pesquisa" : (thumbUrl ? `=IMAGE("${thumbUrl}")` : ""),
    impulsionadoDark: c.impulsionado ? "Impulsionado" : "Dark",
    perfilVeiculacao: "",
    tipoCompra: Array.isArray(c.tipos_compra) ? c.tipos_compra.join(", ") : "",
    objetivo: objetivoPorTiposCompra(c.tipos_compra),
    segmentacao: c.segmentacao || "",
    status: c.status || "",
    orcamentoProjetado: c.eh_performance && c.orcamento_projetado
      ? Number(c.orcamento_projetado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "",
    urlDestino: c.url_destino || "",
    linkPublicacao: "",
    dataInicio: formatarData(c.periodo_inicio),
    dataFim: formatarData(c.periodo_fim),
    formularioCaptura: c.tipos_compra?.includes("CPL") ? (c.formulario_nativo ? "Nativo da plataforma" : "Site/LP externa") : "",
    observacoesFormularioNativo: c.observacoes_formulario_nativo || "",
    searchTitulos: listaNumerada(c.search_campos?.titulo, "Título"),
    searchTitulosLongos: listaNumerada(c.search_campos?.tituloLongo, "Título longo"),
    searchTextos: listaNumerada(c.search_campos?.texto, "Descrição"),
    searchPalavrasChave: c.search_campos?.palavrasChave || "",
  };

  return colunas.map((col) => mapa[col.key] ?? "");
}

// 3 linhas de cabecalho + linha de colunas, mesmo padrao visual do Excel
// (sem a formatacao de cor -- values.update escreve so valores, formatacao
// ficaria pra uma chamada batchUpdate separada, fora de escopo por ora).
function linhasDeCabecalho(nomeCampanha, colunas) {
  const totalColunas = colunas.length;
  const linhaTitulo = [`CAMPANHA: ${nomeCampanha?.toUpperCase() || ""}`, ...Array(totalColunas - 1).fill("")];
  const linhaData = [`Data da última atualização: ${new Date().toLocaleDateString("pt-BR")}`, ...Array(totalColunas - 1).fill("")];
  const linhaColunas = colunas.map((c) => c.header);
  return [linhaTitulo, linhaData, linhaColunas];
}

// Mapa nomeAba -> sheetId (id numerico interno, necessario pra batchUpdate
// de formatacao -- values.update so aceita o nome).
async function listarAbasExistentes(sheets, spreadsheetId) {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  return new Map((data.sheets || []).map((s) => [s.properties.title, s.properties.sheetId]));
}

async function garantirAba(sheets, spreadsheetId, nomeAba, abasExistentes) {
  if (abasExistentes.has(nomeAba)) return abasExistentes.get(nomeAba);
  const { data } = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: nomeAba } } }] },
  });
  const sheetId = data.replies[0].addSheet.properties.sheetId;
  abasExistentes.set(nomeAba, sheetId);
  return sheetId;
}

// Ponto (pt) -> pixel, mesma conversao usada no Excel (creativesExportService.js).
const PT_PARA_PX = 1 / 0.75;
const ROW_HEIGHT_PX = Math.round(ROW_HEIGHT_PT * PT_PARA_PX);
// "Caracteres" do Excel nao existem no Sheets -- largura direto em pixels,
// com folga pra caber o texto sem cortar (Sheets usa px nativamente).
const COL_WIDTH_PX = {
  default: 140,
  peca: Math.round(THUMB_WIDTH_PX),
};

// Formata a aba pra ficar parecida com o Excel exportado: altura das linhas
// de dados fixa (cabe a miniatura sem cortar/esticar), largura de coluna por
// tipo, cabecalho com as mesmas cores (azul no titulo/data, verde claro no
// cabecalho das colunas), texto centralizado com quebra de linha. Roda
// depois de values.update -- values.update nao mexe em formatacao, so em
// conteudo, entao precisa dessa chamada separada de batchUpdate.
function requestsDeFormatacao(sheetId, colunas, totalLinhasDados) {
  const totalColunas = colunas.length;
  const linhaInicioDados = 3; // 0-based: linhas 0-2 sao cabecalho (titulo, data, colunas)

  const requests = [
    // Largura de cada coluna.
    ...colunas.map((col, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: col.key === "peca" ? COL_WIDTH_PX.peca : COL_WIDTH_PX.default },
        fields: "pixelSize",
      },
    })),
    // Altura das linhas de dados (cabe a miniatura 9:16 sem distorcer).
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: linhaInicioDados, endIndex: linhaInicioDados + totalLinhasDados },
        properties: { pixelSize: ROW_HEIGHT_PX },
        fields: "pixelSize",
      },
    },
    // Linha 1 (titulo da campanha): fundo azul, texto branco, negrito.
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalColunas },
        cell: { userEnteredFormat: { backgroundColor: { red: 0.122, green: 0.361, blue: 0.545 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
    // Linha 2 (data de atualizacao): mesmo azul, texto branco italico.
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalColunas },
        cell: { userEnteredFormat: { backgroundColor: { red: 0.122, green: 0.361, blue: 0.545 }, textFormat: { italic: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
    // Linha 3 (cabecalho das colunas): verde claro, negrito, centralizado.
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: totalColunas },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.890, green: 0.937, blue: 0.914 },
            textFormat: { bold: true },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    // Linhas de dados: centralizado, meio, com quebra de linha (pras listas
    // numeradas de Search e observacoes longas nao ficarem cortadas).
    {
      repeatCell: {
        range: { sheetId, startRowIndex: linhaInicioDados, endRowIndex: linhaInicioDados + totalLinhasDados, startColumnIndex: 0, endColumnIndex: totalColunas },
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE", wrapStrategy: "WRAP" } },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    },
    // Merge das 3 linhas de cabecalho (titulo e data ocupam a linha inteira,
    // igual ao Excel) -- precisa vir depois da formatacao pra nao quebrar o merge.
    { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalColunas }, mergeType: "MERGE_ALL" } },
    { mergeCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalColunas }, mergeType: "MERGE_ALL" } },
  ];

  return requests;
}

// Sincroniza TODAS as abas (plataformas com criativos + plataformas que
// tinham aba mas nao tem mais criativo nenhum -- essas so tem o conteudo de
// dados limpo, a aba/cabecalho permanece).
export async function sincronizarCampanha(campanhaId) {
  const config = await getCampanhaSheetSyncConfig(campanhaId);
  if (!config) return;

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = config.spreadsheet_id;

    // Roda fora de uma requisicao HTTP (disparado por creativesService.js ou
    // pelo cron) -- "usuario sistema" sem restricao de escopo, mesmo nivel
    // de acesso que "agencia" ja tem no resto do sistema.
    const usuarioSistema = { papel: "agencia" };
    const [todosCreatives, campanha, idsMarcados, colunasConfig] = await Promise.all([
      listCreativesByCampanha(usuarioSistema, campanhaId),
      getCampanhaById(campanhaId),
      getSheetSyncSelecao(campanhaId),
      getExportConfig(campanhaId),
    ]);
    const nomeCampanha = campanha?.nome || "";

    // So os criativos marcados explicitamente pelo usuario entram na
    // planilha -- ver setSheetSyncSelecao.
    const idsMarcadosSet = new Set(idsMarcados);
    const creatives = todosCreatives.filter((c) => idsMarcadosSet.has(c.id));

    const { porPlataforma, ordenadas: plataformasComCriativos } = agruparCreativosPorPlataforma(creatives);
    const abasExistentes = await listarAbasExistentes(sheets, spreadsheetId);

    // Plataformas que ja tem aba na planilha mas nao tem mais criativo
    // nenhum -- mantem a aba, so limpa o conteudo de dados (nunca apaga).
    const plataformasSemCriativos = [...abasExistentes.keys()].filter(
      (nomeAba) => !plataformasComCriativos.some((p) => nomeAbaValido(p) === nomeAba)
    );

    const requestsFormatacao = [];
    for (const plataforma of plataformasComCriativos) {
      const nomeAba = nomeAbaValido(plataforma);
      const sheetId = await garantirAba(sheets, spreadsheetId, nomeAba, abasExistentes);

      const creativesDaAba = porPlataforma.get(plataforma);
      const colunas = resolverColunasDaAba(colunasConfig, plataforma, creativesDaAba);
      const linhas = [
        ...linhasDeCabecalho(nomeCampanha, colunas),
        ...creativesDaAba.map((c) => valoresDaLinha(c, colunas)),
      ];

      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${nomeAba}'!A:Z` });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${nomeAba}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: linhas },
      });
      requestsFormatacao.push(...requestsDeFormatacao(sheetId, colunas, creativesDaAba.length));
    }

    if (requestsFormatacao.length) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: requestsFormatacao } });
    }

    for (const nomeAba of plataformasSemCriativos) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${nomeAba}'!A:Z` });
      // Mantem so as 3 linhas de cabecalho (sem colunas de dados, ja que nao
      // sabemos mais quais eram) com uma nota indicando o estado atual.
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${nomeAba}'!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[`CAMPANHA: ${nomeCampanha?.toUpperCase() || ""}`], ["Nenhum criativo marcado para esta plataforma."]] },
      });
    }

    await query(
      "UPDATE campanha_sheets_sync SET ultima_sincronizacao_em = now(), ultimo_erro = NULL, ultimo_erro_em = NULL WHERE campanha_id = $1",
      [campanhaId]
    );
  } catch (err) {
    console.error(`Falha ao sincronizar campanha ${campanhaId} com Google Sheets:`, err);
    await query(
      "UPDATE campanha_sheets_sync SET ultimo_erro = $2, ultimo_erro_em = now() WHERE campanha_id = $1",
      [campanhaId, err.message || "Erro desconhecido ao sincronizar"]
    ).catch(() => {});
  }
}

// Dispatcher chamado pelos pontos de escrita de creativesService.js -- no-op
// instantaneo se a campanha nao tiver vinculo (nenhum custo pras campanhas
// que nao usam esse recurso). Nunca lanca -- a operacao principal (criar/
// editar/excluir criativo) ja foi persistida no banco antes desta chamada,
// uma falha aqui nao pode derrubar isso.
export async function agendarSyncSheet(campanhaId) {
  if (!campanhaId) return;
  try {
    const config = await getCampanhaSheetSyncConfig(campanhaId);
    if (!config) return;
    await sincronizarCampanha(campanhaId);
  } catch (err) {
    console.error(`agendarSyncSheet falhou pra campanha ${campanhaId}:`, err);
  }
}

// Usado pelo cron de seguranca -- resincroniza todas as campanhas com
// vinculo ativo, cobrindo falhas transitorias do await sincrono.
export async function sincronizarTodasAsCampanhas() {
  const { rows } = await query("SELECT campanha_id FROM campanha_sheets_sync");
  for (const { campanha_id } of rows) {
    await sincronizarCampanha(campanha_id);
  }
}
