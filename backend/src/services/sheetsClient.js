import { getSheetsClient } from "../config/googleSheets.js";
import { normalizeImageUrl } from "../utils/imageUrl.js";
import { getCampanhaSheetConfig } from "./campanhasService.js";

const CACHE_TTL_MS = 60_000;
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { value, timestamp: Date.now() });
}

// Limpa o cache de serie diaria de uma campanha -- chamado ao salvar/remover o
// vinculo de planilha, para uma edicao de mapeamento refletir na hora em vez de
// esperar ate 60s. Cobre tanto a chave single quanto qualquer chave multi
// (comparativos, cron) que inclua esta campanha na lista de ids.
export function invalidateCache(campanhaId) {
  cache.delete(`realizado-detalhado:${campanhaId}`);
  for (const key of [...cache.keys()]) {
    if (!key.startsWith("realizado-detalhado-multi:")) continue;
    const ids = key.slice("realizado-detalhado-multi:".length).split(",");
    if (ids.includes(String(campanhaId))) cache.delete(key);
  }
}

// Converte a primeira linha (cabecalho) + linhas seguintes em objetos { coluna: valor }.
function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const [header, ...lines] = rows;
  return lines.map((line) => {
    const obj = {};
    header.forEach((col, i) => {
      obj[col.trim()] = line[i] ?? "";
    });
    return obj;
  });
}

// Datas na planilha vem como "DD/MM/YYYY"; convertemos para "YYYY-MM-DD" (comparavel via string).
function parseBRDate(value) {
  const [day, month, year] = (value || "").split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Numeros na planilha usam "." como separador de milhar (ex: "92.184").
function parseBRNumber(value) {
  if (!value) return 0;
  return Number(String(value).replace(/\./g, "").replace(",", ".")) || 0;
}

// Custo vem formatado como "R$ 2.389,41".
function parseBRCurrency(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(cleaned) || 0;
}

// Le uma celula pelo NOME REAL da coluna (mapeamento por campanha), nao por um
// literal fixo -- diferente do modelo antigo (uma unica planilha global com
// headers conhecidos). Coluna nao mapeada (campo opcional sem valor definido no
// vinculo) retorna undefined, que os parsers acima ja tratam como "sem dado"/0.
function col(row, columnName) {
  if (!columnName) return undefined;
  return row[columnName];
}

// Normaliza uma linha da planilha da campanha para o formato usado em Analise por
// Criativo, usando o mapeamento de colunas salvo em campanha_sheets (config) --
// cada campanha pode ter nomes de coluna completamente diferentes.
// IMPORTANTE: "veiculo"/"plataforma" no objeto normalizado sempre significou a
// PLATAFORMA de midia (Meta Ads, Google Search...), nao o vendor/agenciador
// (coluna "vendedor", cadastrado em Perfil > Veiculos).
function normalizeCriativoRow(row, config) {
  return {
    data: parseBRDate(col(row, config.col_data)),
    campanha: col(row, config.col_campanha),
    veiculo: col(row, config.col_plataforma),
    plataforma: col(row, config.col_plataforma),
    vendedor: col(row, config.col_vendedor),
    adName: col(row, config.col_ad_name),
    adGroup: col(row, config.col_ad_group),
    nomeCriativo: col(row, config.col_nome_criativo),
    imagemCriativo: normalizeImageUrl(col(row, config.col_imagem_criativo)),
    tipoCompra: col(row, config.col_tipo_compra),
    posicionamento: col(row, config.col_posicionamento),
    investimento: parseBRCurrency(col(row, config.col_investimento)),
    impressoes: parseBRNumber(col(row, config.col_impressoes)),
    cliques: parseBRNumber(col(row, config.col_cliques)),
    alcance: parseBRNumber(col(row, config.col_impressoes)),
    videoViews: parseBRNumber(col(row, config.col_video_views)),
    videoViews25: parseBRNumber(col(row, config.col_video_views_25)),
    videoViews50: parseBRNumber(col(row, config.col_video_views_50)),
    videoViews75: parseBRNumber(col(row, config.col_video_views_75)),
    videoCompletions: parseBRNumber(col(row, config.col_video_completions)),
    engajamentos: parseBRNumber(col(row, config.col_engajamentos)),
    leads: col(row, config.col_leads) === undefined ? null : parseBRNumber(col(row, config.col_leads)),
  };
}

async function fetchSheetRows(spreadsheetId, range) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

// Busca so a linha de cabecalho de uma planilha/aba -- usado na tela de vinculo
// (Perfil > Integrações de Planilha) para popular os dropdowns de mapeamento antes
// de salvar. Erros do Google (id invalido, aba inexistente, sem acesso) sao
// relancados com mensagem clara para a rota devolver 400 em vez de 500.
export async function fetchSheetHeaders(spreadsheetId, range) {
  try {
    const rows = await fetchSheetRows(spreadsheetId, range);
    if (!rows.length) throw new Error("A planilha/aba está vazia");
    return rows[0].map((h) => String(h).trim()).filter(Boolean);
  } catch (err) {
    if (err.message?.includes("planilha/aba está vazia")) throw err;
    // Log do erro real do Google (motivo especifico: id invalido, aba
    // inexistente, sem permissao etc) -- a mensagem devolvida ao cliente e
    // generica de proposito (nao expor detalhes internos da API do Google), mas
    // sem logar aqui o diagnostico fica impossivel de depurar.
    console.error("Falha ao ler headers da planilha:", spreadsheetId, range, err.message);
    throw new Error(
      "Não foi possível ler a planilha. Confira o ID/URL, o nome da aba e se a conta de serviço tem acesso de Leitor."
    );
  }
}

// Serie diaria de UMA campanha, lida da planilha vinculada a ela (campanha_sheets).
// Sem vinculo (config == null), degrada graciosamente para [] -- mesmo espirito do
// GA4 sem ga4_property_id: "sem dado", nao erro.
export async function getRealizadoDetalhado(campanhaId) {
  if (process.env.DATA_SOURCE !== "sheets") return [];

  const cacheKey = `realizado-detalhado:${campanhaId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const config = await getCampanhaSheetConfig(campanhaId);
  const data = config
    ? rowsToObjects(await fetchSheetRows(config.spreadsheet_id, config.sheet_range)).map((row) =>
        normalizeCriativoRow(row, config)
      )
    : [];

  setCached(cacheKey, data);
  return data;
}

// Serie diaria de VARIAS campanhas de uma vez (comparativos, cron de sincronizacao
// de status) -- resolve a config de cada campanha, deduplica por planilha+aba
// (2 campanhas podem compartilhar a mesma planilha) para nao buscar a mesma
// planilha duas vezes, busca cada planilha distinta em paralelo e concatena.
export async function getRealizadoDetalhadoMulti(campanhaIds) {
  if (process.env.DATA_SOURCE !== "sheets") return [];
  if (!campanhaIds?.length) return [];

  const idsOrdenados = [...new Set(campanhaIds)].sort((a, b) => a - b);
  const cacheKey = `realizado-detalhado-multi:${idsOrdenados.join(",")}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const configs = (
    await Promise.all(idsOrdenados.map((id) => getCampanhaSheetConfig(id)))
  ).filter(Boolean);

  const porPlanilha = new Map();
  for (const config of configs) {
    const key = `${config.spreadsheet_id}::${config.sheet_range}`;
    if (!porPlanilha.has(key)) porPlanilha.set(key, config);
  }

  const linhasPorPlanilha = await Promise.all(
    [...porPlanilha.values()].map(async (config) => {
      const rows = rowsToObjects(await fetchSheetRows(config.spreadsheet_id, config.sheet_range));
      return rows.map((row) => normalizeCriativoRow(row, config));
    })
  );

  const data = linhasPorPlanilha.flat();
  setCached(cacheKey, data);
  return data;
}
