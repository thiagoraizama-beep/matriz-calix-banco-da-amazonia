import { getAnalyticsDataClient } from "../config/googleAnalytics.js";

// Reduz a URL de destino do criativo (que pode vir com dominio/protocolo/query)
// para o pagePath puro, que e o formato que o GA4 usa na dimensao pagePath.
function toPagePath(url) {
  try {
    const { pathname } = new URL(url);
    return pathname || "/";
  } catch {
    return url;
  }
}

async function runReport(propertyId, { dimensions, metrics, dimensionFilter, dateRanges }) {
  const client = getAnalyticsDataClient();
  const { data } = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: { dimensions, metrics, dimensionFilter, dateRanges },
  });
  return data;
}

function somaMetrica(reportData) {
  if (!reportData?.rows?.length) return 0;
  return reportData.rows.reduce((acc, row) => acc + Number(row.metricValues?.[0]?.value || 0), 0);
}

// Total de sessoes na URL de destino do criativo, dentro do periodo informado.
// Retorna 0 se nao houver dados; nao lanca excecao pra nao quebrar a tela do
// criativo -- erro de API (property sem acesso, id invalido etc) e logado e
// tratado como "sem dado" pelo caller.
export async function getSessoesPorUrl(propertyId, url, dataInicio, dataFim) {
  if (!propertyId || !url) return null;
  try {
    const data = await runReport(propertyId, {
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: {
        filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: toPagePath(url) } },
      },
      dateRanges: [{ startDate: dataInicio, endDate: dataFim }],
    });
    return somaMetrica(data);
  } catch (err) {
    console.error("Falha ao buscar sessoes GA4:", err.message);
    return null;
  }
}

// Duracao media de sessao (segundos) na URL de destino do criativo, dentro do
// periodo informado. Mesma semantica de getSessoesPorUrl: null quando faltar
// property/URL ou em erro da API, para o caller distinguir "sem dado" de "0".
export async function getDuracaoMediaPorUrl(propertyId, url, dataInicio, dataFim) {
  if (!propertyId || !url) return null;
  try {
    const data = await runReport(propertyId, {
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "averageSessionDuration" }, { name: "sessions" }],
      dimensionFilter: {
        filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: toPagePath(url) } },
      },
      dateRanges: [{ startDate: dataInicio, endDate: dataFim }],
    });
    if (!data?.rows?.length) return 0;
    // Media ponderada pelo numero de sessoes de cada linha (GA4 pode devolver
    // mais de 1 linha pro mesmo pagePath dependendo de outras dimensoes internas).
    let totalSessoes = 0;
    let totalSegundos = 0;
    for (const row of data.rows) {
      const sessoes = Number(row.metricValues?.[1]?.value || 0);
      const duracaoMedia = Number(row.metricValues?.[0]?.value || 0);
      totalSessoes += sessoes;
      totalSegundos += duracaoMedia * sessoes;
    }
    return totalSessoes > 0 ? totalSegundos / totalSessoes : 0;
  } catch (err) {
    console.error("Falha ao buscar duração média de sessão GA4:", err.message);
    return null;
  }
}

// Total de eventos de conversao (nome configurado em GA4_LEAD_EVENT_NAME) na URL
// de destino do criativo. Sem a env var configurada, nem tenta a chamada -- retorna
// null imediatamente, que o caller distingue de "0 leads" (evento configurado mas
// sem conversao) mostrando "Nao configurado" em vez de "0".
export async function getLeadsPorUrl(propertyId, url, dataInicio, dataFim) {
  const eventName = process.env.GA4_LEAD_EVENT_NAME;
  if (!eventName || !propertyId || !url) return null;
  try {
    const data = await runReport(propertyId, {
      dimensions: [{ name: "pagePath" }, { name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            { filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: toPagePath(url) } } },
            { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: eventName } } },
          ],
        },
      },
      dateRanges: [{ startDate: dataInicio, endDate: dataFim }],
    });
    return somaMetrica(data);
  } catch (err) {
    console.error("Falha ao buscar leads GA4:", err.message);
    return null;
  }
}

// Serie diaria de sessoes e leads somadas entre varias URLs de destino (dos
// criativos de uma campanha/plataforma), usada no grafico de evolucao do
// comparativo. Uma unica chamada ao GA4 com dimensao "date" + filtro "pagePath IN
// urls", em vez de 1 chamada por criativo por dia. Sem property/urls, ou se o
// evento de lead nao estiver configurado, os respectivos campos ficam null por
// dia (mesma semantica de getSessoesPorUrl/getLeadsPorUrl: "sem dado", nao "zero").
export async function getSerieDiariaPorUrls(propertyId, urls, dataInicio, dataFim) {
  const urlsUnicas = [...new Set((urls || []).filter(Boolean))];
  if (!propertyId || urlsUnicas.length === 0) return new Map();

  const pagePathFilter = {
    filter: {
      fieldName: "pagePath",
      inListFilter: { values: urlsUnicas.map(toPagePath) },
    },
  };
  const eventName = process.env.GA4_LEAD_EVENT_NAME;

  const [sessoesData, leadsData] = await Promise.all([
    runReport(propertyId, {
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }],
      dimensionFilter: pagePathFilter,
      dateRanges: [{ startDate: dataInicio, endDate: dataFim }],
    }).catch((err) => {
      console.error("Falha ao buscar serie diaria de sessoes GA4:", err.message);
      return null;
    }),
    eventName
      ? runReport(propertyId, {
          dimensions: [{ name: "date" }, { name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            andGroup: {
              expressions: [pagePathFilter, { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: eventName } } }],
            },
          },
          dateRanges: [{ startDate: dataInicio, endDate: dataFim }],
        }).catch((err) => {
          console.error("Falha ao buscar serie diaria de leads GA4:", err.message);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // GA4 retorna a dimensao "date" como YYYYMMDD; convertemos para YYYY-MM-DD
  // pra casar com o formato usado no restante da serie (planilha).
  const toIso = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

  const porDia = new Map();
  for (const row of sessoesData?.rows || []) {
    const iso = toIso(row.dimensionValues[0].value);
    porDia.set(iso, { ...(porDia.get(iso) || {}), sessoes: Number(row.metricValues?.[0]?.value || 0) });
  }
  for (const row of leadsData?.rows || []) {
    const iso = toIso(row.dimensionValues[0].value);
    porDia.set(iso, { ...(porDia.get(iso) || {}), leads: Number(row.metricValues?.[0]?.value || 0) });
  }
  return porDia;
}
