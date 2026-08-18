import { Router } from "express";
import {
  getFilterOptions,
  getSummary,
  getCampanhaSummary,
  getCampanhaSeries,
  getPlataformaSeries,
  getCreatives,
  getCreativeByAdName,
  getCreativeSeries,
  getPerformancePorCampanha,
} from "../services/creativeAnalysisService.js";
import { temAcessoFeature, plataformasPermitidasNaCampanha, modelosCompraPermitidos, modeloCompraPorPlataformaNaCampanha } from "../utils/scopeFilter.js";
import { getCampanhaById, listCampanhas } from "../services/campanhasService.js";
import { listCreativesByCampanha } from "../services/creativesService.js";

const router = Router();

// Valor que nunca bate com nenhum tipoCompra real da planilha -- usado para
// bloquear (fail-closed) um vinculo "veiculo"/"parceiro" sem nenhuma meta
// cadastrada, em vez de liberar tudo por engano (fail-open).
const NENHUM_MODELO_COMPRA = ["__nenhum_modelo_cadastrado__"];

// tipoCompraForcado: quando o vinculo do usuario ("veiculo"/"parceiro") tem modelo(s)
// de compra cadastrado(s) para esta plataforma, o filtro e travado automaticamente
// neles (ignora o que veio na query) -- evita que o usuario veja/misture metricas de
// outro veiculo que compre a mesma plataforma com um modelo diferente. Se o vinculo
// NAO tem NENHUMA meta cadastrada (array vazio), bloqueia tudo (fail-closed) em vez
// de liberar sem restricao -- dados sigilosos nao podem vazar por falta de cadastro.
// Agencia/cliente (tipoCompraForcado null) continuam com o filtro manual livre, ja
// que gerenciam varios veiculos ao mesmo tempo.
// vendedorForcado: para papel "veiculo"/"parceiro", trava o filtro no(s) nome(s) real(is)
// do vendor vinculado ao usuario (coluna "Veículo" da planilha, ex: "Go On Ad Group") --
// isola os dados de outro vendor que compre a mesma plataforma+modelo de compra na
// mesma campanha, algo que so o modelo de compra sozinho nao consegue garantir.
// Agencia/cliente (vendedorForcado null) sem restricao.
function parseFilters(query, campanhaNome, tipoCompraForcado, vendedorForcado) {
  let tipoCompra = query.tipoCompra || null;
  if (tipoCompraForcado !== null && tipoCompraForcado !== undefined) {
    tipoCompra = tipoCompraForcado.length ? tipoCompraForcado : NENHUM_MODELO_COMPRA;
  }
  // Agencia/cliente (vendedorForcado null) podem filtrar manualmente por vendor via
  // query; veiculo/parceiro sempre usa o valor travado do escopo, ignorando a query.
  const vendedor = vendedorForcado || (query.vendedor || null);
  return {
    vendedor,
    start: query.start || null,
    end: query.end || null,
    // Campanha e travada pela navegacao (campanhaId na URL), nao mais um filtro livre.
    campanha: campanhaNome ? [campanhaNome] : null,
    tipoCompra,
    posicionamento: query.posicionamento || null,
    plataforma: query.plataforma || null,
  };
}

// Todas as plataformas com acesso_analise_criativo=true cadastradas nos vinculos
// desta campanha (independente de qual veiculo/usuario) -- usado para agencia/
// cliente, que nao tem restricao de escopo mas ainda precisam de uma lista real
// (nao mais a antiga lista fixa CREATIVE_VEHICLES).
async function plataformasDaCampanha(campanhaId) {
  const campanhas = await listCampanhas();
  const campanha = campanhas.find((c) => String(c.id) === String(campanhaId));
  if (!campanha) return [];
  const plataformas = new Set();
  for (const v of campanha.veiculos) {
    if (v.acessoAnaliseCriativo === false) continue;
    for (const p of v.plataformasAnaliseCriativo || []) plataformas.add(p);
  }
  return [...plataformas];
}

// Monta o contexto necessario para buscar a serie diaria de sessoes/leads (GA4)
// da campanha: property vinculada + URLs de destino dos criativos com acesso a
// analise (opcionalmente restritas a 1 veiculo, para a serie por plataforma, ou a 1
// Ad Name, para a serie de um criativo especifico) + periodo da campanha (o GA4
// exige um intervalo, diferente da planilha que ja vem so com as linhas do
// periodo). Sem property cadastrada, retorna null e o service simplesmente nao
// mescla sessoes/leads na serie (fica "sem dado").
async function buildGa4SeriesContext(req, campanha, veiculo, adName) {
  if (!campanha.ga4_property_id) return null;
  const creatives = await listCreativesByCampanha(req.user, req.params.campanhaId);
  const urls = creatives
    .filter(
      (c) =>
        c.acesso_analise_criativo === true &&
        c.url_destino &&
        (!veiculo || c.veiculo === veiculo) &&
        (!adName || c.ad_name === adName)
    )
    .map((c) => c.url_destino);
  if (urls.length === 0) return null;
  return {
    propertyId: campanha.ga4_property_id,
    urls,
    dataInicio: campanha.data_inicio,
    dataFim: campanha.data_fim,
  };
}

// Valida que o usuario tem, NA CAMPANHA informada, um vinculo com esta plataforma
// e com acesso_analise_criativo liberado. Agencia/cliente sem restricao de escopo,
// mas ainda precisam de uma campanha valida e da plataforma existir ali.
async function validCampanhaVeiculo(req, res, next) {
  try {
    if (!temAcessoFeature(req.user, "acessoAnaliseCriativo")) {
      return res.status(403).json({ error: "Acesso não permitido a Análise por Criativo" });
    }

    const campanha = await getCampanhaById(req.params.campanhaId);
    if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });

    if (req.user.papel === "veiculo" || req.user.papel === "parceiro") {
      const plataformasNaCampanha = plataformasPermitidasNaCampanha(req.user, req.params.campanhaId, "acessoAnaliseCriativo") || [];
      if (!plataformasNaCampanha.includes(req.params.veiculo)) {
        return res.status(403).json({ error: "Acesso não permitido a este veículo nesta campanha" });
      }
      // Trava o modelo de compra no que o vinculo do usuario tem cadastrado -- nunca
      // vem do client, sempre derivado do escopo, para nao vazar dados de outro veiculo
      // que compre a mesma plataforma com modelo diferente.
      req.tipoCompraForcado = modelosCompraPermitidos(req.user, req.params.campanhaId, req.params.veiculo);
      // Trava tambem o(s) nome(s) reais de vendor vinculados a este usuario (coluna
      // "Veículo" da planilha) -- ultima camada de isolamento entre vendors que
      // comprem a mesma plataforma com o mesmo modelo de compra na mesma campanha.
      req.vendedorForcado = req.user.veiculos || [];
    } else {
      const permitidas = await plataformasDaCampanha(req.params.campanhaId);
      if (!permitidas.includes(req.params.veiculo)) {
        return res.status(404).json({ error: "Veículo inválido nesta campanha" });
      }
      req.tipoCompraForcado = null;
      req.vendedorForcado = null;
    }

    req.campanha = campanha;
    next();
  } catch (err) {
    next(err);
  }
}

// Resumo agregado de uma campanha inteira (todas as plataformas que o usuario tem
// permissao de ver ali), usado no comparativo entre campanhas.
router.get("/:campanhaId/campaign-summary", async (req, res, next) => {
  try {
    if (!temAcessoFeature(req.user, "acessoAnaliseCriativo")) {
      return res.status(403).json({ error: "Acesso não permitido a Análise por Criativo" });
    }
    const campanha = await getCampanhaById(req.params.campanhaId);
    if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });

    let plataformas;
    if (req.user.papel === "veiculo" || req.user.papel === "parceiro") {
      plataformas = plataformasPermitidasNaCampanha(req.user, req.params.campanhaId, "acessoAnaliseCriativo") || [];
    } else {
      plataformas = await plataformasDaCampanha(req.params.campanhaId);
    }

    const modeloCompraPorPlataforma = modeloCompraPorPlataformaNaCampanha(req.user, req.params.campanhaId);
    const resumo = await getCampanhaSummary(campanha.nome, plataformas, modeloCompraPorPlataforma, campanha.id);
    res.json({ campanhaId: campanha.id, campanhaNome: campanha.nome, ...resumo });
  } catch (err) {
    next(err);
  }
});

// Serie diaria agregada da campanha inteira, usada no grafico de evolucao do comparativo.
router.get("/:campanhaId/campaign-series", async (req, res, next) => {
  try {
    if (!temAcessoFeature(req.user, "acessoAnaliseCriativo")) {
      return res.status(403).json({ error: "Acesso não permitido a Análise por Criativo" });
    }
    const campanha = await getCampanhaById(req.params.campanhaId);
    if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });

    let plataformas;
    if (req.user.papel === "veiculo" || req.user.papel === "parceiro") {
      plataformas = plataformasPermitidasNaCampanha(req.user, req.params.campanhaId, "acessoAnaliseCriativo") || [];
    } else {
      plataformas = await plataformasDaCampanha(req.params.campanhaId);
    }

    const modeloCompraPorPlataforma = modeloCompraPorPlataformaNaCampanha(req.user, req.params.campanhaId);
    const ga4 = await buildGa4SeriesContext(req, campanha);
    res.json(await getCampanhaSeries(campanha.nome, plataformas, modeloCompraPorPlataforma, ga4, campanha.id));
  } catch (err) {
    next(err);
  }
});

// Performance de TODOS os criativos cadastrados da campanha, numa unica chamada --
// usado pelos cards da Matriz pra mostrar metricas inline (Investimento/Impressoes/
// Cliques/CTR) sem 1 chamada por card. Mesma guarda de acesso das rotas de campanha
// inteira (campaign-summary/campaign-series); o escopo por criativo/vinculo e
// aplicado dentro do service via listCreativesByCampanha(user, ...).
router.get("/:campanhaId/performance-por-criativo", async (req, res, next) => {
  try {
    if (!temAcessoFeature(req.user, "acessoAnaliseCriativo")) {
      return res.status(403).json({ error: "Acesso não permitido a Análise por Criativo" });
    }
    const campanha = await getCampanhaById(req.params.campanhaId);
    if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });

    res.json(await getPerformancePorCampanha(req.user, req.params.campanhaId));
  } catch (err) {
    next(err);
  }
});

router.get("/:campanhaId/:veiculo/filter-options", validCampanhaVeiculo, async (req, res, next) => {
  try {
    const options = await getFilterOptions(req.params.veiculo, req.params.campanhaId);
    res.json({
      ...options,
      periodoInicio: req.campanha.data_inicio,
      periodoFim: req.campanha.data_fim,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:campanhaId/:veiculo/summary", validCampanhaVeiculo, async (req, res, next) => {
  try {
    res.json(
      await getSummary(
        req.params.veiculo,
        parseFilters(req.query, req.campanha.nome, req.tipoCompraForcado, req.vendedorForcado),
        req.params.campanhaId
      )
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:campanhaId/:veiculo/creatives", validCampanhaVeiculo, async (req, res, next) => {
  try {
    res.json(
      await getCreatives(
        req.params.veiculo,
        parseFilters(req.query, req.campanha.nome, req.tipoCompraForcado, req.vendedorForcado),
        req.params.campanhaId
      )
    );
  } catch (err) {
    next(err);
  }
});

// Performance de UM criativo especifico, buscada sob demanda ao abrir o detalhe de
// um criativo cadastrado na Matriz (evita carregar a lista inteira de Ad Names da
// plataforma so para ver 1). Responde 200 com null quando nao ha dado de performance
// para este Ad Name -- e um estado esperado (campanha nova, ad_name sem match ainda),
// nao um erro.
router.get("/:campanhaId/:veiculo/creatives/:adName/summary", validCampanhaVeiculo, async (req, res, next) => {
  try {
    const filters = parseFilters(req.query, req.campanha.nome, req.tipoCompraForcado, req.vendedorForcado);
    res.json(await getCreativeByAdName(req.params.veiculo, req.params.adName, filters, req.params.campanhaId));
  } catch (err) {
    next(err);
  }
});

router.get("/:campanhaId/:veiculo/creatives/:adName/series", validCampanhaVeiculo, async (req, res, next) => {
  try {
    const ga4 = await buildGa4SeriesContext(req, req.campanha, req.params.veiculo, req.params.adName);
    res.json(
      await getCreativeSeries(
        req.params.veiculo,
        req.params.adName,
        parseFilters(req.query, req.campanha.nome, req.tipoCompraForcado, req.vendedorForcado),
        ga4,
        req.params.campanhaId
      )
    );
  } catch (err) {
    next(err);
  }
});

// Serie diaria agregada de uma plataforma inteira (todos os criativos dela), usada
// no grafico de evolucao do comparativo quando o item selecionado e uma plataforma.
router.get("/:campanhaId/:veiculo/series", validCampanhaVeiculo, async (req, res, next) => {
  try {
    const ga4 = await buildGa4SeriesContext(req, req.campanha, req.params.veiculo);
    res.json(
      await getPlataformaSeries(
        req.params.veiculo,
        parseFilters(req.query, req.campanha.nome, req.tipoCompraForcado, req.vendedorForcado),
        ga4,
        req.params.campanhaId
      )
    );
  } catch (err) {
    next(err);
  }
});

export default router;
