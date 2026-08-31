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
// Fallback em cascata (Ad Name -> Ad Group -> Campaign Name): algumas
// plataformas (Google Performance Max/Search) nao expoem um Ad Name
// individual estavel em relatorio nenhum -- o anuncio responsivo nao tem
// "nome" no sentido que Meta/TikTok tem, e em alguns relatorios nem o Ad
// Group esta disponivel. Ad Name e sempre preferido (mais preciso); Ad
// Group entra so quando nao ha Ad Name; Campaign Name e o ultimo recurso,
// so quando nem Ad Name nem Ad Group existem -- nesse nivel a metrica fica
// por CAMPANHA inteira, dividida entre todos os criativos daquele Campaign
// Name (ver getPerformancePorCampanha). Os dois fallbacks tambem exigem que
// a data da linha da planilha caia dentro do periodo de veiculacao do
// criativo, ja que sao chaves menos especificas que Ad Name sozinho.
export function linhasCasadas(linhasPlanilha, creative, subcanaisPorPlataforma = null) {
  const plataformasValidas = plataformasAceitas(creative.plataforma, subcanaisPorPlataforma);
  const adNameAlvo = normalizarAdName(creative.ad_name);

  if (adNameAlvo) {
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

  // A coluna "Campanha" da planilha pode estar mapeada pro nome curto do
  // sistema (ex: "Capital de Giro - Etapa 2") OU pelo Campaign Name longo do
  // Google (ex: "2026_CAMPANHA_CONVERSAO_X") -- depende de qual coluna real
  // o usuario escolheu no mapeamento (Perfil > Integracoes de Planilha).
  // Aceita bater com QUALQUER um dos dois, em vez de fixar uma prioridade --
  // fixar campaign_name como preferencial (como antes) quebrava o match
  // sempre que a planilha trazia o nome curto da campanha nessa coluna.
  const candidatosCampanha = [creative.campanha, creative.campaign_name].filter(Boolean);
  const inicio = toISODate(creative.periodo_inicio);
  const fim = toISODate(creative.periodo_fim);
  function dentroDoPeriodo(linha) {
    const dataLinha = toISODate(linha.data);
    return !(inicio && fim && dataLinha && !isWithinRange(dataLinha, inicio, fim));
  }
  // Campanha/Vendedor sao filtros OPCIONAIS aqui -- diferente do caminho por
  // Ad Name, onde sao obrigatorios. A planilha nem sempre tem coluna
  // "Campanha"/"Vendedor" mapeada (ex: consolidado com varias campanhas
  // numa aba so, sem separar vendor); quando a coluna nao esta mapeada,
  // linha.campanha/linha.vendedor vem sempre undefined e um filtro
  // obrigatorio nunca bateria com nada, zerando o card por engano. So
  // filtra por campanha/vendedor quando a linha TEM esse dado preenchido.
  function passaFiltrosComuns(linha) {
    if (!plataformasValidas.includes(linha.plataforma)) return false;
    if (!dentroDoPeriodo(linha)) return false;
    if (linha.campanha && !candidatosCampanha.includes(linha.campanha)) return false;
    if (creative.eh_performance) return true;
    if (linha.vendedor && linha.vendedor !== creative.veiculo) return false;
    if (!creative.tipos_compra?.includes(linha.tipoCompra)) return false;
    return true;
  }

  const adGroupAlvo = normalizarAdName(creative.conjunto);
  if (adGroupAlvo) {
    const linhas = linhasPlanilha.filter((linha) => {
      if (normalizarAdName(linha.adGroup) !== adGroupAlvo) return false;
      return passaFiltrosComuns(linha);
    });
    if (linhas.length > 0) return linhas;
  }

  if (candidatosCampanha.length === 0) return [];
  return linhasPlanilha.filter((linha) => {
    if (!candidatosCampanha.includes(linha.campanha)) return false;
    return passaFiltrosComuns(linha);
  });
}
