export const STATUS_OPTIONS = ["ativo", "pausado", "em_analise", "agendado", "programado", "aprovado", "cancelado", "finalizado"];

export const STATUS_LABEL = {
  ativo: "Ativa",
  pausado: "Pausada",
  em_analise: "Em análise",
  agendado: "Agendada",
  programado: "Programada",
  aprovado: "Aprovada",
  cancelado: "Cancelada",
  finalizado: "Finalizada",
};

export const STATUS_BADGE_CLASS = {
  ativo: "badge-ativo",
  pausado: "badge-inativo",
  em_analise: "badge-inativo",
  agendado: "badge-inativo",
  programado: "badge-inativo",
  aprovado: "badge-ativo",
  cancelado: "badge-finalizado",
  finalizado: "badge-finalizado",
};

// True se o periodo [inicio, fim] informado tem alguma intersecao com o periodo
// de veiculacao da campanha (dataInicio/dataFim). Campanha sem periodo cadastrado
// sempre "bate" (nao ha como saber que ficou fora, entao nao filtra ela fora).
export function periodoIntersecta(dataInicio, dataFim, filtroInicio, filtroFim) {
  if (!filtroInicio || !filtroFim) return true;
  if (!dataInicio && !dataFim) return true;
  const inicioCampanha = dataInicio ? dataInicio.slice(0, 10) : "0000-01-01";
  const fimCampanha = dataFim ? dataFim.slice(0, 10) : "9999-12-31";
  return inicioCampanha <= filtroFim && fimCampanha >= filtroInicio;
}
