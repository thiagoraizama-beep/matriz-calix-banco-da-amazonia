import { listPlataformas } from "../services/plataformasService.js";
import { isWithinRange } from "./dateRange.js";

function normalizarAdName(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function toISODate(value) {
  if (!value) return null;
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

// Map<nomePlataforma, subcanais[]> pronto pra passar em linhasCasadas -- centraliza
// a consulta em plataformas.subcanais pra nao repetir em cada chamador.
export async function getSubcanaisPorPlataforma() {
  const plataformas = await listPlataformas();
  return new Map(plataformas.map((p) => [p.nome, p.subcanais]));
}

// Plataformas cadastradas (ex: "Meta Ads") podem englobar varios subcanais reais na
// planilha (ex: "Facebook", "Instagram") -- ver plataformas.subcanais, mesmo
// mapeamento ja usado em creativeAnalysisService.resolveVeiculosPlanilha. Sem essa
// expansao, um criativo cadastrado com a plataforma-mae nunca casa com nenhuma linha,
// porque a planilha so registra o subcanal real, nunca o nome agregador.
function plataformasAceitas(plataformaCadastrada, subcanaisPorPlataforma) {
  const subcanais = subcanaisPorPlataforma?.get(plataformaCadastrada);
  return subcanais?.length ? [plataformaCadastrada, ...subcanais] : [plataformaCadastrada];
}

// Casa um criativo cadastrado (Postgres) contra as linhas da planilha de Realizado
// por ad_name + plataforma (expandida por subcanais) + vendedor(veiculo) + campanha +
// modelo de compra -- mesma regra usada tanto pelo job de sincronizacao de status
// (statusSyncService.js) quanto pelo endpoint de performance em lote da Matriz
// (creativeAnalysisService.js).
// subcanaisPorPlataforma: Map<nomePlataforma, string[]> (de plataformasService.listPlataformas),
// opcional -- sem ele, compara so o nome exato cadastrado (comportamento anterior).
// Nao filtra por formato/posicionamento: o criativo ja e conhecido (nao e busca por
// Ad Name ambiguo), entao esses campos ja sao especificos o suficiente pra somar
// as linhas de entrega dele.
// Criativos marcados "Performance" (creative.eh_performance) pulam o filtro de
// vendedor/modelo de compra: nesse fluxo o vendor e sempre a propria agencia e a
// planilha nao tem coluna de Modelo de Compra, entao exigir esses campos so
// descartava todas as linhas silenciosamente (card ficava zerado mesmo com dado
// existente na planilha).
//
// Fallback por Ad Group: algumas plataformas (Google Performance Max/Search)
// nao expoem um Ad Name individual estavel em relatorio nenhum -- o anuncio
// responsivo nao tem "nome" no sentido que Meta/TikTok tem. Quando o criativo
// cadastrado NAO tem ad_name preenchido, casa por Ad Group + Veiculo + Tipo de
// compra em vez de Ad Name, e so considera linhas cuja data cai dentro do
// periodo de veiculacao do criativo (sem isso, Ad Group sozinho e generico
// demais e arriscaria somar dias de fora do periodo certo).
export function linhasCasadas(linhasPlanilha, creative, subcanaisPorPlataforma = null) {
  const plataformasValidas = plataformasAceitas(creative.plataforma, subcanaisPorPlataforma);
  const adNameAlvo = normalizarAdName(creative.ad_name);

  if (!adNameAlvo) {
    const adGroupAlvo = normalizarAdName(creative.conjunto);
    if (!adGroupAlvo) return [];
    const inicio = toISODate(creative.periodo_inicio);
    const fim = toISODate(creative.periodo_fim);
    return linhasPlanilha.filter((linha) => {
      if (normalizarAdName(linha.adGroup) !== adGroupAlvo) return false;
      if (!plataformasValidas.includes(linha.plataforma)) return false;
      if (linha.campanha !== creative.campanha) return false;
      const dataLinha = toISODate(linha.data);
      if (inicio && fim && dataLinha && !isWithinRange(dataLinha, inicio, fim)) return false;
      if (creative.eh_performance) return true;
      if (linha.vendedor !== creative.veiculo) return false;
      if (!creative.tipos_compra?.includes(linha.tipoCompra)) return false;
      return true;
    });
  }

  return linhasPlanilha.filter((linha) => {
    if (normalizarAdName(linha.adName) !== adNameAlvo) return false;
    if (!plataformasValidas.includes(linha.plataforma)) return false;
    if (linha.campanha !== creative.campanha) return false;
    if (creative.eh_performance) return true;
    if (linha.vendedor !== creative.veiculo) return false;
    if (!creative.tipos_compra?.includes(linha.tipoCompra)) return false;
    return true;
  });
}
