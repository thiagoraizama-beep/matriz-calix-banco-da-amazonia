// Regras de status baseadas na aba "Período de Veiculação por campanha":
//
// - Se AMBOS online e offline passaram do dataFim (+ 1 dia de tolerância) → "finalizado"
// - Se só um dos tipos encerrou mas o outro ainda está ativo → "ativo"
// - Se nenhum período está cadastrado na aba → fallback pela última data de dados (10 dias)
// - "finalizado" aparece em cinza no dashboard; "ativo" aparece em verde

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// Retorna true se hoje já passou da dataFim (dia seguinte ao fim = encerrado)
function encerrado(dataFim) {
  if (!dataFim) return false;
  return hoje() > dataFim;
}

// periodos: array de { campanha, dataInicio, dataFim, tipoMidia } para UMA campanha
export function getCampaignStatusFromPeriodos(periodos) {
  if (!periodos || periodos.length === 0) return null; // sem período cadastrado

  const online = periodos.find((p) => p.tipoMidia === "online");
  const offline = periodos.find((p) => p.tipoMidia === "offline");

  // Só avalia tipos que existem na planilha; tipo ausente é ignorado
  const resultados = [];
  if (online) resultados.push(encerrado(online.dataFim));
  if (offline) resultados.push(encerrado(offline.dataFim));

  // Finalizado apenas quando TODOS os tipos cadastrados encerraram
  return resultados.every(Boolean) ? "finalizado" : "ativo";
}

// Fallback quando campanha não tem período cadastrado: usa última data de dados
const INACTIVITY_THRESHOLD_DAYS = 10;

export function getCampaignStatus(lastDataDate, referenceDate = new Date()) {
  if (!lastDataDate) return "inativo";

  const last = new Date(lastDataDate);
  const diffMs = referenceDate.getTime() - last.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > INACTIVITY_THRESHOLD_DAYS ? "inativo" : "ativo";
}
