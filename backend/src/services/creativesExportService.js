import ExcelJS from "exceljs";
import { listCreativesByCampanha } from "./creativesService.js";
import { getCampanhaById } from "./campanhasService.js";
import { gerarTokenDownload } from "./authService.js";
import { agruparCreativosPorPlataforma } from "../utils/agruparCreativosPorPlataforma.js";

// Colunas replicando a planilha manual de acompanhamento de campanha (ver
// print do usuario) -- mesma ordem/rotulos, pra nao exigir nenhum ajuste na
// rotina de quem ja usa essa planilha. Campos que ainda nao existem como
// coluna propria no sistema (Perfil de veiculacao, Objetivo, Link
// parametrizado, Link da publicacao) saem em branco de proposito -- o
// usuario preenche so essas manualmente, sem redigitar o resto.
// Miniatura na coluna "Peça": altura da linha em pontos e largura da coluna
// em "caracteres" (unidade do Excel) calculadas pra manter a proporcao real
// 9:16 dos criativos mobile do print de referencia do usuario -- sem isso a
// imagem fica espremida/esticada ao ser ancorada numa celula com proporcao
// diferente da imagem original.
export const ROW_HEIGHT_PT = 160;
export const THUMB_HEIGHT_PX = ROW_HEIGHT_PT / 0.75;
export const THUMB_WIDTH_PX = THUMB_HEIGHT_PX * (9 / 16);
const PECA_COL_WIDTH = THUMB_WIDTH_PX / 7;

export const COLUNAS_BASE = [
  { header: "Plataforma", key: "plataforma", width: 24 },
  { header: "Data inclusão", key: "dataInclusao", width: 13 },
  { header: "Criativo-título", key: "titulo", width: 26 },
  { header: "Campaign Name", key: "campaignName", width: 26 },
  { header: "Ad Group", key: "adGroup", width: 22 },
  { header: "Ad Name", key: "adName", width: 26 },
  { header: "Formato", key: "formato", width: 16 },
  { header: "Legenda", key: "legenda", width: 40 },
  { header: "Observações", key: "descricao", width: 40 },
  { header: "Link da peça", key: "linkPeca", width: 16 },
  { header: "Peça", key: "peca", width: PECA_COL_WIDTH },
  { header: "Impulsionado/Dark", key: "impulsionadoDark", width: 16 },
  { header: "Perfil de veiculação", key: "perfilVeiculacao", width: 20 },
  { header: "Tipo de compra", key: "tipoCompra", width: 16 },
  { header: "Objetivo", key: "objetivo", width: 18 },
  { header: "Segmentação", key: "segmentacao", width: 40 },
  { header: "Status", key: "status", width: 16 },
  { header: "Orçamento projetado", key: "orcamentoProjetado", width: 18 },
  { header: "URL de destino", key: "urlDestino", width: 30 },
  { header: "Link da publicação", key: "linkPublicacao", width: 30 },
  { header: "Início da veiculação", key: "dataInicio", width: 16 },
  { header: "Final da veiculação", key: "dataFim", width: 16 },
  { header: "Formulário de captura", key: "formularioCaptura", width: 20 },
  { header: "Observações do formulário nativo", key: "observacoesFormularioNativo", width: 40 },
];

// So aparecem na aba de plataformas do Google (Search/Display/PMax) -- em
// outras redes (Meta, LinkedIn etc) esses campos nunca sao preenchidos,
// entao ficam de fora da planilha em vez de aparecerem vazios.
export const COLUNAS_GOOGLE = [
  { header: "Títulos (Search)", key: "searchTitulos", width: 30 },
  { header: "Títulos longos (Search)", key: "searchTitulosLongos", width: 30 },
  { header: "Descrições (Search)", key: "searchTextos", width: 30 },
  { header: "Palavras-chave (Search)", key: "searchPalavrasChave", width: 30 },
];

export function ehPlataformaGoogle(plataforma) {
  return (plataforma || "").toLowerCase().includes("google");
}

export function formatarData(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

// Objetivo e derivado automaticamente do Tipo de compra -- nao existe campo
// proprio pra isso no formulario, cada tipo de compra ja implica um
// objetivo de campanha padrao de mercado.
const OBJETIVO_POR_TIPO_COMPRA = {
  CPC: "Cliques",
  CPM: "Alcance",
  CPV: "Visualizações",
  CPE: "Engajamento",
  CPL: "Leads",
  CPA: "Aquisição",
  CPT: "Tráfego",
  CPF: "Seguidores",
};

export function objetivoPorTiposCompra(tiposCompra) {
  if (!Array.isArray(tiposCompra) || tiposCompra.length === 0) return "";
  return tiposCompra.map((t) => OBJETIVO_POR_TIPO_COMPRA[t] || t).join(", ");
}

// Nome de aba do Excel tem limite de 31 caracteres e proibe alguns simbolos
// (: \ / ? * [ ]) -- normaliza pra nao quebrar a geracao do arquivo.
export function nomeAbaValido(plataforma) {
  const base = (plataforma || "Sem plataforma").replace(/[:\\/?*[\]]/g, "-");
  return base.slice(0, 31) || "Sem plataforma";
}

// Numera cada item da lista (Titulo 1: ..., Titulo 2: ...) em vez de so
// concatenar -- mais facil de contar/referenciar quando ha varios.
export function listaNumerada(valores, rotulo) {
  if (!Array.isArray(valores) || valores.length === 0) return "";
  return valores.map((v, i) => `${rotulo} ${i + 1}: ${v}`).join("\n");
}

// Forca download em vez de abrir preview inline no navegador -- fl_attachment
// e uma transformacao nativa do Cloudinary que adiciona Content-Disposition:
// attachment na resposta. So se aplica a URLs do proprio Cloudinary (o link
// pode ser link_postagem, uma URL externa qualquer, que fica como esta).
export function urlComDownloadForcado(url) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", "/upload/fl_attachment/");
}

// Video no Cloudinary nao tem um arquivo de imagem proprio -- a URL abaixo
// pede um frame estatico (primeiro segundo) como .jpg, gerado on-the-fly
// pelo proprio Cloudinary a partir do video original.
export function urlThumbnail(cloudinaryUrl, tipoMidia) {
  if (!cloudinaryUrl) return null;
  if (tipoMidia !== "video") return cloudinaryUrl;
  return cloudinaryUrl.replace("/video/upload/", "/video/upload/so_1/").replace(/\.\w+$/, ".jpg");
}

// Baixa a miniatura e embute na celula -- falha de rede/imagem ausente nao
// pode derrubar a exportacao inteira, so aquela celula fica sem preview.
// Timeout curto: video (thumbnail gerada sob demanda pelo Cloudinary via
// so_1) pode demorar bem mais que uma imagem pronta -- sem limite, uma unica
// URL lenta trava a exportacao inteira (o export processa linha por linha,
// esperando cada imagem antes de seguir pra proxima).
async function baixarImagem(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get("content-type") || "";
    const extension = contentType.includes("png") ? "png" : "jpeg";
    return { buffer, extension };
  } catch {
    return null;
  }
}

// Constroi as 3 linhas de cabecalho de uma aba, no mesmo padrao da planilha
// manual do usuario: linha 1 = "CAMPANHA: <nome>" mesclada em faixa escura,
// linha 2 = "Data da última atualização:" mesclada, linha 3 = cabecalho das
// colunas. sheet.columns so define largura/key (sem popular headers
// automaticamente), pra essas 3 linhas serem escritas manualmente antes dos
// dados.
function montarCabecalho(sheet, nomeCampanha, colunas) {
  const totalColunas = colunas.length;

  sheet.columns = colunas.map((col) => ({
    key: col.key,
    width: col.width,
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
  }));

  const linhaTitulo = sheet.addRow([`CAMPANHA: ${nomeCampanha?.toUpperCase() || ""}`]);
  sheet.mergeCells(1, 1, 1, totalColunas);
  linhaTitulo.height = 22;
  linhaTitulo.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  linhaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5C8B" } };
  linhaTitulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const linhaData = sheet.addRow([`Data da última atualização: ${new Date().toLocaleDateString("pt-BR")}`]);
  sheet.mergeCells(2, 1, 2, totalColunas);
  linhaData.height = 18;
  linhaData.font = { italic: true, color: { argb: "FFFFFFFF" }, size: 9 };
  linhaData.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5C8B" } };
  linhaData.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const linhaColunas = sheet.addRow(colunas.map((col) => col.header));
  linhaColunas.height = 20;
  linhaColunas.font = { bold: true };
  linhaColunas.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3EFE9" } };
  linhaColunas.alignment = { vertical: "middle", horizontal: "center" };
}

// Lista as plataformas distintas com criativos nessa campanha, pra popular o
// menu "escolher plataformas" antes de exportar.
export async function listPlataformasDaCampanha(user, campanhaId) {
  const creatives = await listCreativesByCampanha(user, campanhaId);
  const plataformas = new Set(creatives.map((c) => c.plataforma || "Sem plataforma"));
  return [...plataformas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// plataformas: lista opcional de plataformas a incluir (ex: ["Meta Ads"]) --
// undefined/vazio exporta todas, igual antes. Usado pra deixar o usuario
// escolher so os canais que quer baixar, em vez de sempre gerar o arquivo
// inteiro. Retorna so o buffer do xlsx -- ver gerarExportacaoMatriz() pra
// decidir entre xlsx puro ou zip (quando ha criativos com multiplos arquivos).
async function gerarExcelMatriz(creatives, campanha, plataformas, baseUrl, campanhaId) {
  const nomeCampanha = campanha?.nome || "";
  // Import dinamico -- creativesColumnsConfigService.js importa COLUNAS_BASE/
  // COLUNAS_GOOGLE deste arquivo, um import estatico aqui criaria um ciclo.
  const { getExportConfig, resolverColunasDaAba } = await import("./creativesColumnsConfigService.js");
  const colunasConfig = campanhaId ? await getExportConfig(campanhaId) : { porPlataforma: {}, porCriativo: {} };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Matriz de Conteúdo Cálix";
  workbook.created = new Date();

  // Uma aba por canal/plataforma (Meta, Google, TikTok...) -- mesma
  // organizacao da planilha manual do usuario. Ordena as plataformas pra
  // gerar as abas sempre na mesma ordem entre exportacoes.
  const { porPlataforma, ordenadas: plataformasOrdenadas } = agruparCreativosPorPlataforma(creatives, plataformas);

  if (plataformasOrdenadas.length === 0) {
    montarCabecalho(workbook.addWorksheet("Sem criativos"), nomeCampanha, COLUNAS_BASE);
  }

  // Baixa todas as miniaturas em PARALELO antes de montar as abas -- baixar
  // uma por vez (aguardando cada fetch antes de seguir pra proxima linha)
  // e o que fazia a exportacao demorar minutos com poucas dezenas de
  // criativos; em paralelo, o tempo total e o da imagem mais lenta, nao a
  // soma de todas.
  const todosCreativesFiltrados = plataformasOrdenadas.flatMap((p) => porPlataforma.get(p));
  const imagensPorCreative = new Map(
    await Promise.all(
      todosCreativesFiltrados.map(async (c) => {
        const thumbUrl = urlThumbnail(c.cloudinary_url, c.tipo_midia);
        return [c.id, thumbUrl ? await baixarImagem(thumbUrl) : null];
      })
    )
  );

  for (const plataforma of plataformasOrdenadas) {
    const sheet = workbook.addWorksheet(nomeAbaValido(plataforma));
    const creativesDaAba = porPlataforma.get(plataforma);
    const colunas = resolverColunasDaAba(colunasConfig, plataforma, creativesDaAba);
    montarCabecalho(sheet, nomeCampanha, colunas);

    for (const c of creativesDaAba) {
      const row = sheet.addRow({
        plataforma: c.plataforma || "",
        dataInclusao: formatarData(c.criado_em),
        titulo: c.titulo || c.nome || "",
        campaignName: c.campanha || "",
        adGroup: c.conjunto || "",
        adName: c.ad_name || "",
        formato: Array.isArray(c.formato) ? c.formato.join(", ") : "",
        legenda: c.descricao || "",
        descricao: c.observacoes || "",
        // Quando o criativo tem mais de 1 arquivo, o link precisa levar pro
        // zip com todos -- so o cloudinary_url da capa perderia os extras.
        // Token proprio (sem expirar, escopado so a esse criativo) pra
        // funcionar clicando direto do Excel, sem sessao logada.
        linkPeca: Number(c.arquivos_extras) > 0
          ? `${baseUrl}/api/download/creatives/${c.id}/files/zip?token=${gerarTokenDownload(c.id)}`
          : urlComDownloadForcado(c.link_postagem || c.cloudinary_url || ""),
        // Search puro nao tem peca visual (so texto) -- em vez de deixar a
        // celula em branco, indica que aquele criativo e Rede de Pesquisa.
        peca: Array.isArray(c.formato) && c.formato.length === 1 && c.formato[0] === "Search" ? "Rede de Pesquisa" : "",
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
        linkPublicacao: c.impulsionado ? (c.link_postagem || "-") : "",
        dataInicio: formatarData(c.periodo_inicio),
        dataFim: formatarData(c.periodo_fim),
        searchTitulos: listaNumerada(c.search_campos?.titulo, "Título"),
        searchTitulosLongos: listaNumerada(c.search_campos?.tituloLongo, "Título longo"),
        searchTextos: listaNumerada(c.search_campos?.texto, "Descrição"),
        searchPalavrasChave: c.search_campos?.palavrasChave || "",
        formularioCaptura: c.tipos_compra?.includes("CPL") ? (c.formulario_nativo ? "Nativo da plataforma" : "Site/LP externa") : "",
        observacoesFormularioNativo: c.observacoes_formulario_nativo || "",
      });
      row.height = ROW_HEIGHT_PT;
      row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      const pecaColIndex = colunas.findIndex((col) => col.key === "peca");
      const imagem = pecaColIndex >= 0 ? imagensPorCreative.get(c.id) : null;
      if (imagem) {
        const imageId = workbook.addImage({ buffer: imagem.buffer, extension: imagem.extension });
        // tl + ext (em pixels) preserva a proporcao real da imagem -- como
        // a coluna "Peça" e a altura da linha ja foram dimensionadas na
        // mesma proporcao 9:16, a imagem ocupa a celula quase por inteiro
        // sem esticar/espremer.
        sheet.addImage(imageId, {
          tl: { col: pecaColIndex + 0.04, row: row.number - 1 + 0.04 },
          ext: { width: THUMB_WIDTH_PX * 0.92, height: THUMB_HEIGHT_PX * 0.92 },
          editAs: "oneCell",
        });
      }
    }
  }

  return workbook.xlsx.writeBuffer();
}

// Exportacao da campanha e SEMPRE xlsx puro -- criativos com multiplos
// arquivos ja tem um link proprio pra baixar so os arquivos deles (coluna
// "Link da peça", ver linkPeca acima), entao nao empacota o excel inteiro
// num zip por causa disso.
// baseUrl vem da propria requisicao (req.protocol + req.get('host')), nao de
// env var -- assim funciona local e em producao sem depender de configuracao
// extra.
export async function gerarExportacaoMatriz(user, campanhaId, plataformas, baseUrl) {
  const [creatives, campanha] = await Promise.all([
    listCreativesByCampanha(user, campanhaId),
    getCampanhaById(campanhaId),
  ]);
  const buffer = await gerarExcelMatriz(creatives, campanha, plataformas, baseUrl, campanhaId);
  return { tipo: "xlsx", buffer: Buffer.from(buffer) };
}
