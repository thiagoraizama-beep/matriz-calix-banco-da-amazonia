import { listPlataformas } from "../services/plataformasService.js";

function normalizarAdName(value) {
  return (value || "").replace(/\s+/g, " ").trim();
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
export function linhasCasadas(linhasPlanilha, creative, subcanaisPorPlataforma = null) {
  const adNameAlvo = normalizarAdName(creative.ad_name);
  const plataformasValidas = plataformasAceitas(creative.plataforma, subcanaisPorPlataforma);
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
