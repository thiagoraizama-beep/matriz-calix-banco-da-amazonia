import { query } from "../config/database.js";
import { registrarAcao, registrarEdicaoCampos } from "./actionLogService.js";

const LABELS_CAMPOS_CAMPANHA = {
  nome: "Nome",
  dataInicio: "Data de início",
  dataFim: "Data de fim",
  ga4PropertyId: "Property ID GA4",
};

// Status efetivo: se data_fim ja passou, a campanha esta "finalizado" independente
// do status salvo -- data vencida tem prioridade sobre status manual (Pausada/Em
// analise/Ativa nao "seguram" uma campanha cuja data fim ja passou).
function statusEfetivo(row) {
  if (row.data_fim && new Date(row.data_fim) < new Date(new Date().toDateString())) {
    return "finalizado";
  }
  return row.status;
}

function toPublicCampanha(row) {
  return { ...row, status: statusEfetivo(row) };
}

// Retorna campanhas com os veículos, plataformas e metas de contratado vinculados
export async function listCampanhas() {
  const { rows: campanhas } = await query(
    "SELECT * FROM campanhas WHERE excluido_em IS NULL ORDER BY nome ASC"
  );

  const { rows: vinculos } = await query(`
    SELECT cv.*, v.nome AS veiculo_nome, v.logo_url, v.plataformas AS plataformas_veiculo, v.tipo
    FROM campanha_veiculos cv
    JOIN vehicles v ON v.id = cv.vehicle_id
    ORDER BY v.nome ASC
  `);

  const { rows: metas } = await query("SELECT * FROM campanha_veiculo_metas");
  const { rows: sheets } = await query("SELECT * FROM campanha_sheets");
  const sheetPorCampanha = new Map(sheets.map((s) => [s.campanha_id, s]));

  return campanhas.map((c) => ({
    ...toPublicCampanha(c),
    sheetConfig: sheetPorCampanha.get(c.id) || null,
    veiculos: vinculos
      .filter((v) => v.campanha_id === c.id)
      .map((v) => ({
        id: v.id,
        vehicleId: v.vehicle_id,
        nome: v.veiculo_nome,
        logoUrl: v.logo_url,
        tipo: v.tipo,
        tipoMidia: v.tipo_midia,
        plataformas: v.plataformas,
        plataformasVeiculo: v.plataformas_veiculo,
        acessoAnaliseCriativo: v.acesso_analise_criativo,
        acessoMatriz: v.acesso_matriz,
        plataformasAnaliseCriativo: v.plataformas_analise_criativo,
        metas: metas
          .filter((m) => m.campanha_veiculo_id === v.id)
          .map((m) => ({
            id: m.id,
            plataforma: m.plataforma,
            quantidadeContratada: Number(m.quantidade_contratada),
            modeloCompra: m.modelo_compra,
            dataInicio: m.data_inicio,
            dataFim: m.data_fim,
          })),
      })),
  }));
}

// Lista campanhas paginada/pesquisavel para a Home (ponto de entrada pos-login).
// Diferente de listCampanhas() (usada no cadastro, sem paginacao): aqui o volume
// esperado e de milhares de campanhas, entao nao da pra devolver tudo de uma vez.
// - agencia/cliente: sem restricao de escopo, pagina direto no banco.
// - veiculo/parceiro: o volume por usuario e pequeno (so as campanhas dos seus
//   vinculos), entao filtra/pagina em memoria a partir de user.escopos ja resolvido
//   (evita reconsultar campanha_veiculos aqui).
// Contagem de veiculos vinculados e de criativos cadastrados por campanha -- usado
// para enriquecer os cards da Home (evita que o card fique so com nome/status).
async function contagensPorCampanha(campanhaIds, user) {
  if (!campanhaIds.length) return new Map();
  const { rows: veiculosRows } = await query(
    `SELECT campanha_id, COUNT(*)::int AS total FROM campanha_veiculos WHERE campanha_id = ANY($1) GROUP BY campanha_id`,
    [campanhaIds]
  );
  const { rows: criativosRows } = await query(
    `SELECT cv.campanha_id, COUNT(cr.id)::int AS total
     FROM campanha_veiculos cv
     LEFT JOIN creatives cr ON cr.campanha_veiculo_id = cv.id AND cr.excluido_em IS NULL
     WHERE cv.campanha_id = ANY($1)
     GROUP BY cv.campanha_id`,
    [campanhaIds]
  );
  // Verba total: soma orcamento_projetado dos criativos marcados como
  // "Performance" (eh_performance=true) -- unico conceito de orcamento que
  // existe hoje no sistema, em nivel de criativo. Cobre os dois caminhos de
  // vinculo com a campanha: pelo campanha_veiculo_id (normal) e pelo nome
  // textual da campanha (criativos legados sem veiculo vinculado) -- mesmo
  // fallback usado em listCreativesByCampanha, senao esse total divergiria
  // do que aparece somado dentro da propria campanha.
  const { rows: verbaRows } = await query(
    `SELECT c.id AS campanha_id,
            COALESCE(SUM(cr.orcamento_projetado) FILTER (
              WHERE cr.eh_performance = true AND cr.excluido_em IS NULL AND cr.status != 'Rascunho'
            ), 0) AS total
     FROM campanhas c
     LEFT JOIN campanha_veiculos cv ON cv.campanha_id = c.id
     LEFT JOIN creatives cr ON (cr.campanha_veiculo_id = cv.id OR (cr.campanha_veiculo_id IS NULL AND cr.campanha = c.nome))
     WHERE c.id = ANY($1)
     GROUP BY c.id`,
    [campanhaIds]
  );
  const mapa = new Map(campanhaIds.map((id) => [id, { totalVeiculos: 0, totalCriativos: 0, totalVerba: 0, totalGasto: 0 }]));
  for (const r of veiculosRows) mapa.get(r.campanha_id).totalVeiculos = r.total;
  for (const r of criativosRows) mapa.get(r.campanha_id).totalCriativos = r.total;
  for (const r of verbaRows) mapa.get(r.campanha_id).totalVerba = Number(r.total);

  // Investimento REALIZADO (planilha externa) -- so busca pra campanhas que
  // de fato tem verba planejada (as demais nunca mostram a barra no card,
  // ver totalVerba acima), poupando chamadas desnecessarias. Import dinamico
  // pra evitar ciclo (creativeAnalysisService.js importa deste arquivo).
  const idsComVerba = campanhaIds.filter((id) => mapa.get(id).totalVerba > 0);
  if (idsComVerba.length && user) {
    try {
      const { getInvestimentoRealizadoPorCampanha } = await import("./creativeAnalysisService.js");
      const gastos = await getInvestimentoRealizadoPorCampanha(user, idsComVerba);
      for (const [id, total] of gastos) mapa.get(id).totalGasto = total;
    } catch (err) {
      console.error("Falha ao buscar investimento realizado por campanha:", err);
    }
  }

  return mapa;
}

export async function listCampanhasHome(user, { busca = "", status = "", page = 1, pageSize = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * pageSize;

  if (user.papel !== "veiculo" && user.papel !== "parceiro") {
    const params = [];
    const where = ["excluido_em IS NULL"];
    if (busca) {
      params.push(`%${busca}%`);
      where.push(`nome ILIKE $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const { rows } = await query(
      `SELECT *, COUNT(*) OVER() AS total_count FROM campanhas ${whereSql}
       ORDER BY nome ASC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const total = rows[0] ? Number(rows[0].total_count) : 0;
    const contagens = await contagensPorCampanha(rows.map((r) => r.id), user);
    return {
      items: rows.map((r) => {
        const { total_count, ...rest } = r;
        return { ...toPublicCampanha(rest), ...(contagens.get(r.id) || { totalVeiculos: 0, totalCriativos: 0, totalVerba: 0, totalGasto: 0 }) };
      }),
      total,
      page,
      pageSize,
    };
  }

  const escopos = Array.isArray(user.escopos) ? user.escopos : [];
  const porCampanha = new Map();
  for (const e of escopos) {
    if (!porCampanha.has(e.campanhaId)) {
      porCampanha.set(e.campanhaId, {
        id: e.campanhaId,
        nome: e.campanha,
        status: e.campanhaStatus,
        data_inicio: e.data_inicio,
        data_fim: e.data_fim,
      });
    }
  }
  let items = [...porCampanha.values()];
  if (busca) {
    const alvo = busca.toLowerCase();
    items = items.filter((c) => c.nome.toLowerCase().includes(alvo));
  }
  if (status) {
    items = items.filter((c) => c.status === status);
  }
  items.sort((a, b) => a.nome.localeCompare(b.nome));
  const total = items.length;
  items = items.slice(offset, offset + pageSize);
  const contagens = await contagensPorCampanha(items.map((c) => c.id), user);
  items = items.map((c) => ({ ...c, ...(contagens.get(c.id) || { totalVeiculos: 0, totalCriativos: 0, totalVerba: 0, totalGasto: 0 }) }));
  return { items, total, page, pageSize };
}

// Busca dedicada pro Kanban: sem paginacao (precisa ver todas as colunas de
// status de uma vez), mas limitada a campanhas nao finalizadas/canceladas e
// com um teto de seguranca -- o volume esperado do sistema e de milhares de
// campanhas ao longo do tempo, mas a maioria ja finalizada/cancelada nao faz
// sentido aparecer num quadro de gestao do dia a dia.
const LIMITE_KANBAN = 300;
const STATUS_FORA_DO_KANBAN = ["finalizado", "cancelado"];

export async function listCampanhasKanban(user) {
  if (user.papel !== "veiculo" && user.papel !== "parceiro") {
    const { rows } = await query(
      `SELECT * FROM campanhas WHERE status NOT IN ('finalizado', 'cancelado') AND excluido_em IS NULL
       ORDER BY nome ASC LIMIT ${LIMITE_KANBAN}`
    );
    const contagens = await contagensPorCampanha(rows.map((r) => r.id), user);
    return rows.map((r) => ({ ...toPublicCampanha(r), ...(contagens.get(r.id) || { totalVeiculos: 0, totalCriativos: 0, totalVerba: 0, totalGasto: 0 }) }));
  }

  const escopos = Array.isArray(user.escopos) ? user.escopos : [];
  const porCampanha = new Map();
  for (const e of escopos) {
    if (!porCampanha.has(e.campanhaId)) {
      porCampanha.set(e.campanhaId, {
        id: e.campanhaId,
        nome: e.campanha,
        status: e.campanhaStatus,
        data_inicio: e.data_inicio,
        data_fim: e.data_fim,
      });
    }
  }
  let items = [...porCampanha.values()].filter((c) => !STATUS_FORA_DO_KANBAN.includes(c.status));
  items.sort((a, b) => a.nome.localeCompare(b.nome));
  items = items.slice(0, LIMITE_KANBAN);
  const contagens = await contagensPorCampanha(items.map((c) => c.id), user);
  return items.map((c) => ({ ...c, ...(contagens.get(c.id) || { totalVeiculos: 0, totalCriativos: 0, totalVerba: 0, totalGasto: 0 }) }));
}

// Usado internamente por outras operacoes (restaurar, editar, exibir detalhe na
// lixeira) -- de proposito SEM filtro de excluido_em, ja que tambem precisa achar
// campanhas que estao na lixeira.
export async function getCampanhaById(id) {
  const { rows } = await query("SELECT * FROM campanhas WHERE id = $1", [id]);
  return rows[0] ? toPublicCampanha(rows[0]) : null;
}

export async function createCampanha(nome, { dataInicio, dataFim } = {}, alteradoPor = null) {
  const { rows } = await query(
    "INSERT INTO campanhas (nome, data_inicio, data_fim) VALUES ($1, $2, $3) RETURNING *",
    [nome, dataInicio || null, dataFim || null]
  );
  const campanha = rows[0];
  await registrarAcao({
    entidadeTipo: "campanha",
    entidadeId: campanha.id,
    entidadeNome: campanha.nome,
    campanhaId: campanha.id,
    acao: "criacao",
    alteradoPor,
  });
  return { ...toPublicCampanha(campanha), veiculos: [] };
}

export async function updateCampanhaNome(id, nome, { dataInicio, dataFim } = {}, alteradoPor = null) {
  const antiga = await getCampanhaById(id);
  const { rows } = await query(
    `UPDATE campanhas SET
      nome = $2,
      data_inicio = COALESCE($3, data_inicio),
      data_fim = COALESCE($4, data_fim)
     WHERE id = $1 RETURNING *`,
    [id, nome, dataInicio || null, dataFim || null]
  );
  const campanha = rows[0];
  if (campanha && antiga) {
    await registrarEdicaoCampos({
      entidadeTipo: "campanha",
      entidadeId: campanha.id,
      entidadeNome: campanha.nome,
      campanhaId: campanha.id,
      camposAntes: {
        nome: antiga.nome,
        dataInicio: antiga.data_inicio?.toString().slice(0, 10),
        dataFim: antiga.data_fim?.toString().slice(0, 10),
      },
      camposDepois: { nome, dataInicio: dataInicio || undefined, dataFim: dataFim || undefined },
      alteradoPor,
      labels: LABELS_CAMPOS_CAMPANHA,
    });
  }
  return campanha ? toPublicCampanha(campanha) : null;
}

// Resolve o Property ID do GA4 a usar para um filtro de campanha do Dashboard.
// So retorna um valor quando o filtro aponta para exatamente UMA campanha e ela tem
// property vinculada -- sem filtro, com varias campanhas, ou campanha sem vinculo,
// retorna null (o chamador mostra "Sem dados" em vez de misturar properties diferentes
// ou usar uma property "padrao" que pode nao ter nada a ver com a campanha certa).
export async function resolveGa4PropertyId(campanhaFiltro) {
  const nomes = Array.isArray(campanhaFiltro) ? campanhaFiltro : campanhaFiltro ? [campanhaFiltro] : [];
  if (nomes.length !== 1) return null;
  const { rows } = await query("SELECT ga4_property_id FROM campanhas WHERE nome = $1", [nomes[0]]);
  return rows[0]?.ga4_property_id || null;
}

// Vincula/desvincula o Property ID do GA4 desta campanha (Perfil > Integrações GA4).
// ga4PropertyId null/vazio remove o vinculo -- o card de Sessoes volta a mostrar
// "Sem dados" para essa campanha em vez de tentar consultar uma property inexistente.
export async function updateGa4PropertyId(id, ga4PropertyId, alteradoPor = null) {
  const antiga = await getCampanhaById(id);
  const { rows } = await query(
    "UPDATE campanhas SET ga4_property_id = $2 WHERE id = $1 RETURNING *",
    [id, ga4PropertyId || null]
  );
  const campanha = rows[0];
  if (campanha && antiga) {
    await registrarEdicaoCampos({
      entidadeTipo: "campanha",
      entidadeId: campanha.id,
      entidadeNome: campanha.nome,
      campanhaId: campanha.id,
      camposAntes: { ga4PropertyId: antiga.ga4_property_id },
      camposDepois: { ga4PropertyId: ga4PropertyId || null },
      alteradoPor,
      labels: LABELS_CAMPOS_CAMPANHA,
    });
  }
  return campanha ? toPublicCampanha(campanha) : null;
}

// Le o vinculo de planilha (Sheet ID + range + mapeamento de colunas) desta
// campanha -- usado internamente por sheetsClient.js para saber de onde/como ler
// os dados de mídia dela. Retorna null quando a campanha ainda nao foi vinculada
// a nenhuma planilha (degradacao graciosa, mesmo espirito do GA4 sem property).
export async function getCampanhaSheetConfig(campanhaId) {
  const { rows } = await query("SELECT * FROM campanha_sheets WHERE campanha_id = $1", [campanhaId]);
  return rows[0] || null;
}

// Cria/atualiza o vinculo de planilha desta campanha (Perfil > Integrações de
// Planilha). Um vinculo por campanha (UNIQUE campanha_id) -- salvar de novo
// substitui o anterior por completo, inclusive campos de mapeamento omitidos
// (ficam null), ja que a tela sempre reenvia o mapeamento inteiro.
export async function upsertCampanhaSheet(campanhaId, { spreadsheetId, range, mapping }) {
  const {
    data, campanha, plataforma, vendedor, adName, nomeCriativo, imagemCriativo,
    tipoCompra, posicionamento, investimento, impressoes, cliques,
    videoViews, videoViews25, videoViews50, videoViews75, videoCompletions, engajamentos, leads,
  } = mapping || {};

  const { rows } = await query(
    `INSERT INTO campanha_sheets (
      campanha_id, spreadsheet_id, sheet_range,
      col_data, col_campanha, col_plataforma, col_vendedor, col_ad_name,
      col_nome_criativo, col_imagem_criativo, col_tipo_compra, col_posicionamento,
      col_investimento, col_impressoes, col_cliques,
      col_video_views, col_video_views_25, col_video_views_50, col_video_views_75,
      col_video_completions, col_engajamentos, col_leads
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    ON CONFLICT (campanha_id) DO UPDATE SET
      spreadsheet_id = EXCLUDED.spreadsheet_id,
      sheet_range = EXCLUDED.sheet_range,
      col_data = EXCLUDED.col_data,
      col_campanha = EXCLUDED.col_campanha,
      col_plataforma = EXCLUDED.col_plataforma,
      col_vendedor = EXCLUDED.col_vendedor,
      col_ad_name = EXCLUDED.col_ad_name,
      col_nome_criativo = EXCLUDED.col_nome_criativo,
      col_imagem_criativo = EXCLUDED.col_imagem_criativo,
      col_tipo_compra = EXCLUDED.col_tipo_compra,
      col_posicionamento = EXCLUDED.col_posicionamento,
      col_investimento = EXCLUDED.col_investimento,
      col_impressoes = EXCLUDED.col_impressoes,
      col_cliques = EXCLUDED.col_cliques,
      col_video_views = EXCLUDED.col_video_views,
      col_video_views_25 = EXCLUDED.col_video_views_25,
      col_video_views_50 = EXCLUDED.col_video_views_50,
      col_video_views_75 = EXCLUDED.col_video_views_75,
      col_video_completions = EXCLUDED.col_video_completions,
      col_engajamentos = EXCLUDED.col_engajamentos,
      col_leads = EXCLUDED.col_leads,
      atualizado_em = now()
    RETURNING *`,
    [
      campanhaId, spreadsheetId, range,
      data, campanha || null, plataforma, vendedor || null, adName || null,
      nomeCriativo || null, imagemCriativo || null, tipoCompra || null, posicionamento || null,
      investimento, impressoes, cliques,
      videoViews || null, videoViews25 || null, videoViews50 || null, videoViews75 || null,
      videoCompletions || null, engajamentos || null, leads || null,
    ]
  );
  return rows[0];
}

// Remove o vinculo de planilha desta campanha -- getRealizadoDetalhado volta a
// retornar [] para ela (degradacao graciosa).
export async function deleteCampanhaSheet(campanhaId) {
  const { rowCount } = await query("DELETE FROM campanha_sheets WHERE campanha_id = $1", [campanhaId]);
  return rowCount > 0;
}

export async function updateCampanhaStatus(id, status, alteradoPor = null) {
  const antiga = await getCampanhaById(id);
  const { rows } = await query(
    "UPDATE campanhas SET status = $2 WHERE id = $1 RETURNING *",
    [id, status]
  );
  const campanha = rows[0];
  if (campanha && antiga) {
    await registrarAcao({
      entidadeTipo: "campanha",
      entidadeId: campanha.id,
      entidadeNome: campanha.nome,
      campanhaId: campanha.id,
      acao: "status",
      campo: "Status",
      valorAnterior: antiga.status,
      valorNovo: status,
      alteradoPor,
    });
  }
  return campanha ? toPublicCampanha(campanha) : null;
}

// Manda a campanha pra lixeira (soft-delete) -- os vinculos (campanha_veiculos,
// campanha_sheets) continuam intactos no banco, so deixam de ser visiveis atraves
// da campanha nas listagens normais; o CASCADE de fato so roda na exclusao
// definitiva (excluirCampanhaDefinitiva).
export async function deleteCampanha(id, alteradoPor = null) {
  const campanha = await getCampanhaById(id);
  if (!campanha || campanha.excluido_em) return false;

  await registrarAcao({
    entidadeTipo: "campanha",
    entidadeId: campanha.id,
    entidadeNome: campanha.nome,
    campanhaId: campanha.id,
    acao: "exclusao",
    alteradoPor,
  });

  await query(
    "UPDATE campanhas SET excluido_em = now(), excluido_por = $2 WHERE id = $1",
    [id, alteradoPor]
  );
  return true;
}

// Lista campanhas na lixeira, com nome de quem excluiu para exibicao.
export async function listLixeiraCampanhas() {
  const { rows } = await query(
    `SELECT c.*, u.nome AS excluido_por_nome
     FROM campanhas c
     LEFT JOIN users u ON u.id = c.excluido_por
     WHERE c.excluido_em IS NOT NULL
     ORDER BY c.excluido_em DESC`
  );
  return rows.map(toPublicCampanha);
}

export async function restaurarCampanha(id, alteradoPor = null) {
  const { rows } = await query(
    `UPDATE campanhas SET excluido_em = NULL, excluido_por = NULL WHERE id = $1 RETURNING *`,
    [id]
  );
  const restaurada = rows[0];
  if (restaurada) {
    await registrarAcao({
      entidadeTipo: "campanha",
      entidadeId: restaurada.id,
      entidadeNome: restaurada.nome,
      campanhaId: restaurada.id,
      acao: "restauracao",
      alteradoPor,
    });
  }
  return restaurada ? toPublicCampanha(restaurada) : null;
}

// Exclusao definitiva (esvaziar lixeira): apaga a campanha de verdade, cascateando
// para campanha_veiculos/campanha_sheets/campanha_veiculo_metas via ON DELETE
// CASCADE ja definido no schema. Criativos vinculados NAO sao apagados em cascata
// (campanha_veiculo_id usa ON DELETE SET NULL) -- se ainda existirem criativos
// ativos vinculados, eles so perdem a referencia a campanha, permanecendo intactos.
export async function excluirCampanhaDefinitiva(id, alteradoPor = null) {
  const campanha = await getCampanhaById(id);
  if (!campanha) return false;

  const { rowCount } = await query("DELETE FROM campanhas WHERE id = $1", [id]);
  if (rowCount > 0) {
    await registrarAcao({
      entidadeTipo: "campanha",
      entidadeId: campanha.id,
      entidadeNome: campanha.nome,
      campanhaId: null,
      acao: "exclusao_definitiva",
      alteradoPor,
    });
  }
  return rowCount > 0;
}

// Adiciona ou atualiza o vínculo de um veículo numa campanha com suas plataformas,
// o escopo de midia (online/offline/ambos), as permissoes de acesso (Analise por
// Criativo / Matriz de Conteudo) e QUAIS plataformas do vinculo aparecem em
// Analise por Criativo -- tudo contextual a ESTA campanha especifica.
export async function upsertCampanhaVeiculo(campanhaId, vehicleId, plataformas, tipoMidia, permissoes = {}) {
  const acessoAnaliseCriativo = permissoes.acessoAnaliseCriativo !== false;
  const acessoMatriz = permissoes.acessoMatriz !== false;
  const plataformasAnaliseCriativo = acessoAnaliseCriativo ? (permissoes.plataformasAnaliseCriativo || []) : [];
  const { rows } = await query(
    `INSERT INTO campanha_veiculos (campanha_id, vehicle_id, plataformas, tipo_midia, acesso_analise_criativo, acesso_matriz, plataformas_analise_criativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (campanha_id, vehicle_id)
     DO UPDATE SET plataformas = EXCLUDED.plataformas, tipo_midia = EXCLUDED.tipo_midia,
       acesso_analise_criativo = EXCLUDED.acesso_analise_criativo, acesso_matriz = EXCLUDED.acesso_matriz,
       plataformas_analise_criativo = EXCLUDED.plataformas_analise_criativo
     RETURNING *`,
    [campanhaId, vehicleId, plataformas, tipoMidia || "online", acessoAnaliseCriativo, acessoMatriz, plataformasAnaliseCriativo]
  );
  return rows[0];
}

export async function deleteCampanhaVeiculo(id) {
  const { rowCount } = await query("DELETE FROM campanha_veiculos WHERE id = $1", [id]);
  return rowCount > 0;
}

// Cadastra/atualiza uma meta (quantidade contratada + periodo) de uma plataforma
// dentro de um vinculo campanha+veiculo, identificada pela combinacao
// plataforma+modeloCompra -- permite que a mesma plataforma tenha varias metas
// simultaneas com modelos de compra diferentes (ex: Meta Ads: CPM + CPC). Chamar de
// novo com o MESMO modelo para a mesma plataforma atualiza a meta existente (upsert);
// com um modelo diferente, cria uma meta adicional.
// data_inicio/data_fim nulos = herda o periodo da campanha (resolvido na leitura, nao aqui).
export async function upsertMetaPlataforma(campanhaVeiculoId, plataforma, { quantidadeContratada, modeloCompra, dataInicio, dataFim }) {
  const { rows } = await query(
    `INSERT INTO campanha_veiculo_metas (campanha_veiculo_id, plataforma, quantidade_contratada, modelo_compra, data_inicio, data_fim)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (campanha_veiculo_id, plataforma, modelo_compra)
     DO UPDATE SET quantidade_contratada = EXCLUDED.quantidade_contratada,
       data_inicio = EXCLUDED.data_inicio, data_fim = EXCLUDED.data_fim
     RETURNING *`,
    [campanhaVeiculoId, plataforma, quantidadeContratada || 0, modeloCompra || "CPM", dataInicio || null, dataFim || null]
  );
  return rows[0];
}

export async function deleteMetaPlataforma(id) {
  const { rowCount } = await query("DELETE FROM campanha_veiculo_metas WHERE id = $1", [id]);
  return rowCount > 0;
}

// Retorna os vinculos (campanha + plataformas + tipo de midia) de um usuario "veiculo",
// baseado nos nomes de veiculo vinculados a conta (user.veiculos).
// As plataformas sao expandidas pelos seus subcanais cadastrados (ex: "Meta Ads" ->
// ["Facebook", "Instagram"]) para bater com os nomes reais usados na planilha/realizado.
export async function getEscoposUsuario(nomeVeiculos) {
  if (!nomeVeiculos?.length) return [];

  const { rows } = await query(
    `SELECT cv.id AS "campanhaVeiculoId", cv.plataformas, cv.tipo_midia AS "tipoMidia",
            cv.acesso_analise_criativo AS "acessoAnaliseCriativo", cv.acesso_matriz AS "acessoMatriz",
            cv.plataformas_analise_criativo AS "plataformasAnaliseCriativo",
            c.id AS "campanhaId", c.nome AS campanha, c.status, c.data_inicio, c.data_fim,
            v.id AS "vehicleId", v.nome AS veiculo
     FROM campanha_veiculos cv
     JOIN campanhas c ON c.id = cv.campanha_id
     JOIN vehicles v ON v.id = cv.vehicle_id
     WHERE v.nome = ANY($1)`,
    [nomeVeiculos]
  );

  const { rows: plataformasDb } = await query("SELECT nome, subcanais FROM plataformas");
  const subcanaisPorNome = new Map(plataformasDb.map((p) => [p.nome, p.subcanais]));

  // Modelos de compra cadastrados por vinculo+plataforma (ex: um vinculo pode ter Meta
  // Ads em CPC e Google Search em CPM) -- usado para restringir automaticamente qual
  // modelo de compra este vinculo enxerga na Analise por Criativo, evitando misturar
  // metricas de outro veiculo que compre a MESMA plataforma com modelo diferente.
  const vinculoIds = rows.map((r) => r.campanhaVeiculoId);
  const modelosPorVinculo = new Map();
  if (vinculoIds.length > 0) {
    const { rows: metas } = await query(
      "SELECT campanha_veiculo_id AS vinculo_id, plataforma, modelo_compra FROM campanha_veiculo_metas WHERE campanha_veiculo_id = ANY($1)",
      [vinculoIds]
    );
    for (const m of metas) {
      const key = `${m.vinculo_id}:${m.plataforma}`;
      if (!modelosPorVinculo.has(key)) modelosPorVinculo.set(key, []);
      modelosPorVinculo.get(key).push(m.modelo_compra);
    }
  }
  // Inclui o nome da plataforma-mae junto dos subcanais (nao substitui) -- o Dashboard/Deals
  // referencia a plataforma-mae (ex "Meta Ads"), enquanto Midia/Analise por Criativo casam
  // com os nomes reais na planilha (ex "Facebook", "Instagram").
  const expandir = (nomePlataforma) => {
    const subcanais = subcanaisPorNome.get(nomePlataforma);
    return subcanais?.length ? [nomePlataforma, ...subcanais] : [nomePlataforma];
  };

  return rows.map((r) => ({
    ...r,
    campanhaStatus: statusEfetivo(r),
    plataformas: r.plataformas.flatMap(expandir),
    // NAO expandir em subcanais aqui: plataformasAnaliseCriativo alimenta a navegacao
    // campanha-primeiro (um card por plataforma cadastrada, ex "Meta Ads"), diferente de
    // "plataformas" acima que precisa bater com nomes reais na planilha/realizado.
    plataformasAnaliseCriativo: r.plataformasAnaliseCriativo || [],
    // Modelos de compra (CPM/CPC/...) cadastrados para este vinculo, por plataforma --
    // cobre TODAS as plataformas do vinculo (nao so as de Analise por Criativo) E seus
    // subcanais reais (ex: "Meta Ads" -> tambem "Facebook"/"Instagram"), pois tambem
    // alimenta scopeModeloCompraFilter (Dashboard geral), que casa contra r.veiculo da
    // planilha -- o nome real (subcanal), nao a plataforma-mae. Antes so incluia a
    // plataforma-mae das plataformas de plataformasAnaliseCriativo, entao tanto uma
    // plataforma fora dessa lista (ex: "Programatica") quanto qualquer subcanal (ex:
    // "Facebook") ficavam de fora do mapa e suas linhas eram excluidas silenciosamente
    // dos KPIs/grafico do Dashboard para o usuario "veiculo".
    modelosCompraPorPlataforma: Object.fromEntries(
      r.plataformas.flatMap((p) => {
        const modelos = modelosPorVinculo.get(`${r.campanhaVeiculoId}:${p}`) || [];
        return expandir(p).map((nome) => [nome, modelos]);
      })
    ),
  }));
}
