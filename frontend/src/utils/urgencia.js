// "Urgente" = periodo_inicio do criativo cai em hoje ou amanha (comparacao de data,
// sem hora) -- usado tanto pelo card (badge/destaque) quanto pelo banner da Matriz,
// pra nao duplicar essa comparacao em dois lugares.
function toDateOnly(value) {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function diasDeDiferenca(periodoInicio) {
  const data = toDateOnly(periodoInicio);
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffMs = data.getTime() - hoje.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

export function isUrgente(periodoInicio) {
  const dias = diasDeDiferenca(periodoInicio);
  return dias === 0 || dias === 1;
}

export function labelUrgencia(periodoInicio) {
  const dias = diasDeDiferenca(periodoInicio);
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return null;
}
