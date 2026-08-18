import { getRealizadoDetalhado, getRealizadoDetalhadoMulti } from "./sheetsClient.js";
import { isWithinRange } from "../utils/dateRange.js";
import { findCreativeByAdName, listCreativesByCampanha } from "./creativesService.js";
import { listPlataformas } from "./plataformasService.js";
import { listCampanhas, getCampanhaById } from "./campanhasService.js";
import { linhasCasadas, getSubcanaisPorPlataforma } from "../utils/creativeMatch.js";
import { getSessoesPorUrl, getLeadsPorUrl, getSerieDiariaPorUrls } from "./ga4Service.js";

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(isoInicio, isoFim) {
  const a = new Date(`${isoInicio}T00:00:00`);
  const b = new Date(`${isoFim}T00:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function seedRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

// Enquanto DATA_SOURCE=mock (planilha ainda nao conectada), getRealizadoDetalhado()
// retorna sempre []. Para permitir testar Analise por Criativo (filtros, graficos,
// comparativo) com as campanhas/plataformas REAIS ja cadastradas no Postgres, gera
// linhas sinteticas a partir delas -- 20 dias de dados por plataforma com
// acesso_analise_criativo, usando os subcanais cadastrados quando existirem.
// So roda em modo mock; com DATA_SOURCE=sheets, getRealizadoDetalhado() ja retorna
// dados reais e essa geracao nunca e usada.
let mockCache = null;
async function gerarMockAnaliseCriativo() {
  if (mockCache) return mockCache;

  const [campanhas, plataformasCadastradas] = await Promise.all([listCampanhas(), listPlataformas()]);
  const subcanaisPorNome = new Map(plataformasCadastradas.map((p) => [p.nome, p.subcanais]));
  const rand = seedRandom(7);
  const rows = [];

  for (const campanha of campanhas) {
    const plataformasNaCampanha = new Set();
    for (const v of campanha.veiculos) {
      if (v.acessoAnaliseCriativo === false) continue;
      for (const p of v.plataformasAnaliseCriativo || []) plataformasNaCampanha.add(p);
    }

    // Dados sinteticos ficam DENTRO do periodo de veiculacao real da campanha
    // (data_inicio/data_fim cadastrados), para o calendario de filtro bater com o
    // periodo esperado. Sem periodo cadastrado, cai no fallback de ultimos 20 dias.
    const dataInicio = campanha.data_inicio ? new Date(campanha.data_inicio).toISOString().slice(0, 10) : null;
    const dataFim = campanha.data_fim ? new Date(campanha.data_fim).toISOString().slice(0, 10) : null;
    const totalDias = dataInicio && dataFim ? diffDays(dataInicio, dataFim) : 20;

    for (const plataforma of plataformasNaCampanha) {
      const subcanais = subcanaisPorNome.get(plataforma);
      const veiculosPlanilha = subcanais?.length ? subcanais : [plataforma];

      for (const veiculoPlanilha of veiculosPlanilha) {
        for (let dia = 0; dia < totalDias; dia++) {
          const impressoes = Math.round(3000 + rand() * 15000);
          const cliques = Math.round(impressoes * (0.008 + rand() * 0.025));
          const investimento = Number((cliques * (1.2 + rand() * 2)).toFixed(2));
          const videoViews = Math.round(impressoes * (0.15 + rand() * 0.25));
          rows.push({
            data: dataInicio ? addDaysISO(dataInicio, dia) : daysAgoISO(totalDias - 1 - dia),
            campanha: campanha.nome,
            veiculo: veiculoPlanilha,
            plataforma: veiculoPlanilha,
            adName: `${veiculoPlanilha} - Criativo ${(dia % 3) + 1}`,
            nomeCriativo: `${veiculoPlanilha} - Criativo ${(dia % 3) + 1}`,
            imagemCriativo: null,
            tipoCompra: ["CPC", "CPM"][dia % 2],
            posicionamento: ["Feed", "Stories"][dia % 2],
            investimento,
            impressoes,
            cliques,
            alcance: Math.round(impressoes * 0.7),
            videoViews,
            videoViews25: Math.round(videoViews * 0.6),
            videoViews50: Math.round(videoViews * 0.4),
            videoViews75: Math.round(videoViews * 0.25),
            videoCompletions: Math.round(videoViews * 0.15),
            engajamentos: Math.round(cliques * 1.3),
          });
        }
      }
    }
  }

  mockCache = rows;
  return rows;
}

// campanhaIds: id unico (numero/string) ou array de ids das campanhas cujas
// planilhas devem ser lidas -- cada campanha tem seu proprio vinculo de planilha
// (campanha_sheets), diferente do modelo antigo de uma unica planilha global.
async function getRealizadoDetalhadoComMock(campanhaIds) {
  const ids = Array.isArray(campanhaIds) ? campanhaIds : [campanhaIds];
  const real = ids.length === 1 ? await getRealizadoDetalhado(ids[0]) : await getRealizadoDetalhadoMulti(ids);
  if (real.length > 0) return real;
  if (process.env.DATA_SOURCE === "sheets") return real;
  return gerarMockAnaliseCriativo();
}

// Resolve a midia E o nome de exibicao do criativo, cruzando com o cadastro na
// Matriz de Conteudo (Postgres) por campanha + plataforma + modelo de compra + Ad
// Name (do mais especifico para o mais permissivo, ver findCreativeByAdName):
// 1. Usa a imagem que vem diretamente da planilha (coluna "Imagem do Criativo"),
//    que ja foi normalizada pelo sheetsClient (Google Drive -> URL direta).
// 2. So cai na Matriz de Conteudo (Cloudinary) se a planilha nao tiver imagem.
// Isso evita dependencia do Cloudinary para criativos que ja tem imagem na planilha.
// O NOME exibido, porem, sempre prioriza o cadastrado na Matriz quando houver match --
// a coluna "Nome do Criativo" da planilha e preenchida manualmente e costuma ficar
// vazia/inconsistente, enquanto o nome da Matriz e a fonte confiavel.
// Cruzamento estrito com a planilha (Sheets): Ad Name + Plataforma + Veiculo(vendor) +
// Campanha + Modelo de Compra + Formato, todos vindos da linha do Realizado. Sem
// nenhum fallback mais permissivo -- preferir sem match a arriscar misturar o
// criativo de um vendor/formato/campanha com o de outro.
async function resolveCreativeMedia(adName, nomeCriativo, veiculoOpcao, imagemDaPlanilha, posicionamento, campanha, modeloCompra, vendedor) {
  const fromMatrix = await findCreativeByAdName(adName, veiculoOpcao, vendedor, posicionamento, campanha, modeloCompra);

  const cloudinaryUrl = fromMatrix?.cloudinary_url || null;
  const cloudinaryTipo = fromMatrix?.tipo_midia || "image";
  // Nome e formato vem exclusivamente da Matriz de Conteudo (cadastro real) -- a
  // planilha so fornece numeros/metricas, nunca esses dois campos, para nao mostrar
  // um "Nome do Criativo"/Posicionamento da planilha desatualizado ou divergente.
  const nome = fromMatrix?.nome || null;
  const formato = fromMatrix?.formato || null;
  // Status de veiculacao: mesma leitura, so editavel pela Matriz de Conteudo --
  // aqui e so exibicao (badge), nao ha rota de update na Analise por Criativo.
  const status = fromMatrix?.status || null;

  // Cloudinary tem prioridade — URLs de terceiros (postimg, ibb.co) bloqueiam hotlink
  if (cloudinaryUrl) {
    return { url: cloudinaryUrl, tipo: cloudinaryTipo, cloudinaryUrl, cloudinaryTipo, nome, formato, status };
  }
  if (imagemDaPlanilha) {
    return { url: imagemDaPlanilha, tipo: "image", cloudinaryUrl: null, cloudinaryTipo: "image", nome, formato, status };
  }
  return { url: null, tipo: "image", cloudinaryUrl: null, cloudinaryTipo: "image", nome, formato, status };
}

// Veiculos de criativo exibidos no submenu lateral. Mantido como lista de
// referencia para o CREATIVE_VEHICLES.includes() de validacao de rota -- o
// casamento real com a planilha agora vem dos subcanais cadastrados em Plataformas.
export const CREATIVE_VEHICLES = ["Meta", "TikTok", "YouTube", "Kwai"];

// Resolve os "subcanais" (nomes reais na planilha de realizado) de uma plataforma
// cadastrada pela agencia. Ex: plataforma "Meta Ads" com subcanais ["Facebook",
// "Instagram"] cadastrados na aba Plataformas -> filtro de Analise por Criativo
// busca linhas com veiculo "Facebook" OU "Instagram". Sem subcanal cadastrado,
// usa o proprio nome da plataforma como veiculo da planilha.
async function resolveVeiculosPlanilha(veiculoOpcao) {
  const plataformas = await listPlataformas();
  const encontrada = plataformas.find((p) => p.nome === veiculoOpcao);
  return encontrada?.subcanais?.length ? encontrada.subcanais : [veiculoOpcao];
}

// Aceita filtro como valor unico ou array (multi-selecao). Vazio/null/[] = sem filtro.
function matchesFilter(rowValue, filterValue) {
  if (!filterValue) return true;
  if (Array.isArray(filterValue)) return filterValue.length === 0 || filterValue.includes(rowValue);
  return rowValue === filterValue;
}

function filterRows(rows, veiculosPlanilha, filters) {
  const { start, end, campanha, tipoCompra, posicionamento, plataforma, vendedor } = filters;

  return rows.filter(
    (r) =>
      veiculosPlanilha.includes(r.veiculo) &&
      (!start || !end || isWithinRange(r.data, start, end)) &&
      matchesFilter(r.campanha, campanha) &&
      matchesFilter(r.tipoCompra, tipoCompra) &&
      matchesFilter(r.posicionamento, posicionamento) &&
      matchesFilter(r.veiculo, plataforma) &&
      matchesFilter(r.vendedor, vendedor)
  );
}

function ctr(impressoes, cliques) {
  return impressoes > 0 ? (cliques / impressoes) * 100 : 0;
}

export async function getFilterOptions(veiculoOpcao, campanhaId) {
  const [rows, veiculosPlanilha] = await Promise.all([getRealizadoDetalhadoComMock(campanhaId), resolveVeiculosPlanilha(veiculoOpcao)]);
  const doVeiculo = rows.filter((r) => veiculosPlanilha.includes(r.veiculo));

  const campanhas = [...new Set(doVeiculo.map((r) => r.campanha))].filter(Boolean).sort();
  const tiposCompra = [...new Set(doVeiculo.map((r) => r.tipoCompra))].filter(Boolean).sort();
  const posicionamentos = [...new Set(doVeiculo.map((r) => r.posicionamento))].filter(Boolean).sort();
  // Vendedores (vendors reais, ex: "Go On Ad Group") que aparecem na planilha para esta
  // plataforma -- filtro manual usado por agencia/cliente, que gerenciam varios vendors
  // ao mesmo tempo e nao tem essa restricao forcada automaticamente (ver vendedorForcado).
  const vendedores = [...new Set(doVeiculo.map((r) => r.vendedor))].filter(Boolean).sort();
  // Plataforma (ex: Facebook/Instagram) so aparece como filtro quando a plataforma
  // cadastrada engloba mais de um subcanal na planilha.
  const plataformas = veiculosPlanilha.length > 1 ? veiculosPlanilha : [];

  return { campanhas, tiposCompra, posicionamentos, plataformas, vendedores };
}

function summarize(rows) {
  const totals = rows.reduce(
    (acc, r) => ({
      investimento: acc.investimento + r.investimento,
      impressoes: acc.impressoes + r.impressoes,
      alcance: acc.alcance + r.alcance,
      cliques: acc.cliques + r.cliques,
    }),
    { investimento: 0, impressoes: 0, alcance: 0, cliques: 0 }
  );

  const cpm = totals.impressoes > 0 ? (totals.investimento / totals.impressoes) * 1000 : 0;
  const cpc = totals.cliques > 0 ? totals.investimento / totals.cliques : 0;
  const frequencia = totals.alcance > 0 ? totals.impressoes / totals.alcance : 0;

  return {
    ...totals,
    cpm: Number(cpm.toFixed(2)),
    cpc: Number(cpc.toFixed(2)),
    ctr: Number(ctr(totals.impressoes, totals.cliques).toFixed(2)),
    frequencia: Number(frequencia.toFixed(2)),
  };
}

export async function getSummary(veiculoOpcao, filters, campanhaId) {
  const [rows, veiculosPlanilha] = await Promise.all([getRealizadoDetalhadoComMock(campanhaId), resolveVeiculosPlanilha(veiculoOpcao)]);
  return summarize(filterRows(rows, veiculosPlanilha, filters));
}

// Restringe linhas ao(s) modelo(s) de compra permitidos por plataforma, quando o
// usuario tem essa restricao (ver modelosCompraPorPlataforma em scopeFilter.js).
// modeloCompraPorPlataforma: Map<plataforma, string[]> ou null (sem restricao, agencia/
// cliente). Fail-closed: se o Map existe mas a plataforma nao tem NENHUM modelo
// cadastrado, bloqueia tudo daquela plataforma em vez de liberar por engano.
function filtraPorModeloCompraPermitido(rows, modeloCompraPorPlataforma) {
  if (!modeloCompraPorPlataforma) return rows;
  return rows.filter((r) => {
    const permitidos = modeloCompraPorPlataforma.get(r.veiculo) || [];
    return permitidos.includes(r.tipoCompra);
  });
}

// Resumo agregado de TODAS as plataformas de uma campanha (usado no comparativo
// entre campanhas) -- soma as linhas cujo campo "veiculo" bate com qualquer uma
// das plataformas informadas, dentro da campanha.
export async function getCampanhaSummary(campanhaNome, plataformas, modeloCompraPorPlataforma, campanhaId) {
  const rows = await getRealizadoDetalhadoComMock(campanhaId);
  const doCampanha = filtraPorModeloCompraPermitido(
    rows.filter((r) => r.campanha === campanhaNome && plataformas.includes(r.veiculo)),
    modeloCompraPorPlataforma
  );

  const porPlataforma = new Map();
  for (const p of plataformas) porPlataforma.set(p, []);
  for (const r of doCampanha) porPlataforma.get(r.veiculo)?.push(r);

  return {
    total: summarize(doCampanha),
    porPlataforma: Object.fromEntries(
      [...porPlataforma.entries()].map(([p, rowsDaPlataforma]) => [p, summarize(rowsDaPlataforma)])
    ),
  };
}

// Mescla sessoes/leads diarios (GA4) na serie diaria ja calculada a partir da
// planilha, casando por data. Sem property/urls, os pontos existentes ficam sem
// os campos sessoes/leads (o frontend so mostra a linha se a metrica selecionada
// tiver dado). Datas que so existem no GA4 (sem linha de planilha naquele dia)
// tambem entram, senao a serie de sessoes/leads ficaria incompleta.
async function mesclarSerieGa4(byDate, propertyId, urls, dataInicio, dataFim) {
  if (!propertyId || !dataInicio || !dataFim) return;
  const serieGa4 = await getSerieDiariaPorUrls(propertyId, urls, dataInicio, dataFim);
  for (const [data, valores] of serieGa4) {
    if (!byDate.has(data)) byDate.set(data, { data });
    Object.assign(byDate.get(data), valores);
  }
}

// Serie diaria de uma plataforma inteira dentro de uma campanha (sem filtrar por
// criativo especifico), usada no grafico de evolucao do comparativo.
export async function getPlataformaSeries(veiculoOpcao, filters, ga4, campanhaId) {
  const [rows, veiculosPlanilha] = await Promise.all([getRealizadoDetalhadoComMock(campanhaId), resolveVeiculosPlanilha(veiculoOpcao)]);
  const filteredRows = filterRows(rows, veiculosPlanilha, filters);

  const byDate = new Map();
  for (const r of filteredRows) {
    if (!byDate.has(r.data)) {
      byDate.set(r.data, { data: r.data, impressoes: 0, cliques: 0, investimento: 0, videoViews: 0 });
    }
    const entry = byDate.get(r.data);
    entry.impressoes += r.impressoes;
    entry.cliques += r.cliques;
    entry.investimento += r.investimento;
    entry.videoViews += r.videoViews;
  }

  if (ga4) await mesclarSerieGa4(byDate, ga4.propertyId, ga4.urls, ga4.dataInicio, ga4.dataFim);

  return Array.from(byDate.values()).sort((a, b) => (a.data < b.data ? -1 : 1));
}

// Serie diaria agregada de uma campanha inteira (todas as plataformas informadas),
// usada no grafico de evolucao do comparativo entre campanhas.
export async function getCampanhaSeries(campanhaNome, plataformas, modeloCompraPorPlataforma, ga4, campanhaId) {
  const rows = filtraPorModeloCompraPermitido(
    (await getRealizadoDetalhadoComMock(campanhaId)).filter((r) => r.campanha === campanhaNome && plataformas.includes(r.veiculo)),
    modeloCompraPorPlataforma
  );

  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.data)) {
      byDate.set(r.data, { data: r.data, impressoes: 0, cliques: 0, investimento: 0, videoViews: 0 });
    }
    const entry = byDate.get(r.data);
    entry.impressoes += r.impressoes;
    entry.cliques += r.cliques;
    entry.investimento += r.investimento;
    entry.videoViews += r.videoViews;
  }

  if (ga4) await mesclarSerieGa4(byDate, ga4.propertyId, ga4.urls, ga4.dataInicio, ga4.dataFim);

  return Array.from(byDate.values()).sort((a, b) => (a.data < b.data ? -1 : 1));
}

// Serie diaria de um criativo especifico (Ad Name), para o grafico de evolucao no modal de detalhe.
export async function getCreativeSeries(veiculoOpcao, adName, filters, ga4, campanhaId) {
  const [allRows, veiculosPlanilha] = await Promise.all([getRealizadoDetalhadoComMock(campanhaId), resolveVeiculosPlanilha(veiculoOpcao)]);
  const rows = filterRows(allRows, veiculosPlanilha, filters).filter(
    (r) => (r.adName || r.nomeCriativo) === adName
  );

  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.data)) {
      byDate.set(r.data, { data: r.data, impressoes: 0, cliques: 0, videoViews: 0, investimento: 0 });
    }
    const entry = byDate.get(r.data);
    entry.impressoes += r.impressoes;
    entry.cliques += r.cliques;
    entry.videoViews += r.videoViews;
    entry.investimento += r.investimento;
  }

  if (ga4) await mesclarSerieGa4(byDate, ga4.propertyId, ga4.urls, ga4.dataInicio, ga4.dataFim);

  return Array.from(byDate.values()).sort((a, b) => (a.data < b.data ? -1 : 1));
}

// Agrupa linhas ja filtradas por criativo (Ad Name), somando metricas de todas as
// linhas/dias daquele criativo, e resolve midia/nome/status cruzando com o cadastro
// na Matriz de Conteudo. Extraida de getCreatives para ser reaproveitada tambem por
// getCreativeByAdName (mesma agregacao, so que sobre um subconjunto de linhas de 1
// Ad Name so, evitando duplicar a logica de soma + resolveCreativeMedia).
async function agruparPorAdName(rows, veiculoOpcao, filters) {
  const byAd = new Map();
  for (const r of rows) {
    const key = r.adName || r.nomeCriativo;
    if (!byAd.has(key)) {
      byAd.set(key, {
        adName: r.adName,
        nomeCriativo: r.nomeCriativo,
        imagemCriativo: r.imagemCriativo,
        tipoCompra: r.tipoCompra,
        posicionamento: r.posicionamento,
        plataforma: r.veiculo,
        vendedor: r.vendedor,
        investimento: 0,
        impressoes: 0,
        cliques: 0,
        videoViews: 0,
        videoViews25: 0,
        videoViews50: 0,
        videoViews75: 0,
        videoCompletions: 0,
        engajamentos: 0,
      });
    }
    const entry = byAd.get(key);
    entry.investimento += r.investimento;
    entry.impressoes += r.impressoes;
    entry.cliques += r.cliques;
    entry.videoViews += r.videoViews;
    entry.videoViews25 += r.videoViews25;
    entry.videoViews50 += r.videoViews50;
    entry.videoViews75 += r.videoViews75;
    entry.videoCompletions += r.videoCompletions;
    entry.engajamentos += r.engajamentos;
  }

  const campanhaNome = Array.isArray(filters.campanha) ? filters.campanha[0] : filters.campanha;

  return Promise.all(
    Array.from(byAd.values()).map(async (c) => {
      const media = await resolveCreativeMedia(c.adName, c.nomeCriativo, veiculoOpcao, c.imagemCriativo, c.posicionamento, campanhaNome, c.tipoCompra, c.vendedor);
      return {
        ...c,
        nomeCriativo: media?.nome || null,
        posicionamento: media?.formato || null,
        status: media?.status || null,
        imagemCriativo: media?.url || null,
        cloudinaryUrl: media?.cloudinaryUrl || null,
        tipoMidia: media?.cloudinaryTipo || media?.tipo || "image",
        investimento: Number(c.investimento.toFixed(2)),
        ctr: Number(ctr(c.impressoes, c.cliques).toFixed(2)),
        vtr: c.impressoes > 0 ? Number(((c.videoViews / c.impressoes) * 100).toFixed(2)) : 0,
        cpm: c.impressoes > 0 ? Number(((c.investimento / c.impressoes) * 1000).toFixed(2)) : 0,
        cpc: c.cliques > 0 ? Number((c.investimento / c.cliques).toFixed(2)) : 0,
      };
    })
  );
}

// Agrupa por criativo (Ad Name), somando metricas de todas as linhas/dias daquele criativo.
export async function getCreatives(veiculoOpcao, filters, campanhaId) {
  const [allRows, veiculosPlanilha] = await Promise.all([getRealizadoDetalhadoComMock(campanhaId), resolveVeiculosPlanilha(veiculoOpcao)]);
  const rows = filterRows(allRows, veiculosPlanilha, filters);
  return agruparPorAdName(rows, veiculoOpcao, filters);
}

// Performance de UM Ad Name especifico dentro de uma plataforma -- usado pelo card
// fundido da Matriz (Fase 4 do plano), que busca performance sob demanda ao abrir o
// detalhe de um criativo cadastrado, em vez de carregar a lista inteira de Ad Names
// da plataforma. Retorna null quando nao ha nenhuma linha para este Ad Name (sem
// dado de performance ainda, ou fora do periodo filtrado) -- nunca lanca erro por
// "nao encontrado", esse e um estado esperado e tratado pelo caller.
export async function getCreativeByAdName(veiculoOpcao, adName, filters, campanhaId) {
  const [allRows, veiculosPlanilha] = await Promise.all([getRealizadoDetalhadoComMock(campanhaId), resolveVeiculosPlanilha(veiculoOpcao)]);
  const rows = filterRows(allRows, veiculosPlanilha, filters).filter((r) => (r.adName || r.nomeCriativo) === adName);
  if (rows.length === 0) return null;

  const [creative] = await agruparPorAdName(rows, veiculoOpcao, filters);
  return creative || null;
}

// Performance (Investimento/Impressoes/Cliques/CTR) de TODOS os criativos cadastrados
// de uma campanha, numa unica resposta -- usado pelos cards da Matriz pra mostrar
// metricas inline sem 1 chamada por card. Diferente de getCreatives (que e por
// plataforma e usa resolveCreativeMedia pra casar planilha->cadastro), aqui o
// caminho e inverso: parte dos criativos ja cadastrados (listCreativesByCampanha,
// que ja aplica o escopo/permissao do usuario) e casa cada um contra a planilha via
// linhasCasadas -- a mesma funcao usada pelo job de sincronizacao de status. So
// contempla criativos com acesso_analise_criativo=true e ad_name preenchido; os
// demais nao entram no mapa de retorno (fail-closed, mesmo padrao do restante do
// sistema).
export async function getPerformancePorCampanha(user, campanhaId) {
  const creatives = (await listCreativesByCampanha(user, campanhaId)).filter(
    (c) => c.acesso_analise_criativo === true && c.ad_name
  );
  if (creatives.length === 0) return {};

  const [linhasPlanilha, campanha, subcanaisPorPlataforma] = await Promise.all([
    getRealizadoDetalhado(campanhaId),
    getCampanhaById(campanhaId),
    getSubcanaisPorPlataforma(),
  ]);
  const propertyId = campanha?.ga4_property_id || null;
  const hoje = new Date().toISOString().slice(0, 10);
  const resultado = {};

  await Promise.all(
    creatives.map(async (creative) => {
      const linhas = linhasCasadas(linhasPlanilha, creative, subcanaisPorPlataforma);
      const investimento = linhas.reduce((acc, l) => acc + l.investimento, 0);
      const impressoes = linhas.reduce((acc, l) => acc + l.impressoes, 0);
      const cliques = linhas.reduce((acc, l) => acc + l.cliques, 0);

      // Sessoes/leads (GA4) so sao buscados quando ha URL de destino cadastrada e a
      // campanha tem Property ID vinculado -- sem isso, ficam null (nao tenta a
      // chamada), distinguindo "sem configuracao" de "zero" no frontend.
      let sessoes = null;
      let leads = null;
      if (propertyId && creative.url_destino) {
        const dataInicio = creative.periodo_inicio
          ? new Date(creative.periodo_inicio).toISOString().slice(0, 10)
          : hoje;
        const dataFim = creative.periodo_fim ? new Date(creative.periodo_fim).toISOString().slice(0, 10) : hoje;
        [sessoes, leads] = await Promise.all([
          getSessoesPorUrl(propertyId, creative.url_destino, dataInicio, dataFim),
          getLeadsPorUrl(propertyId, creative.url_destino, dataInicio, dataFim),
        ]);
      }

      resultado[creative.id] = {
        investimento: Number(investimento.toFixed(2)),
        impressoes,
        cliques,
        ctr: Number(ctr(impressoes, cliques).toFixed(2)),
        sessoes,
        leads,
      };
    })
  );

  return resultado;
}
