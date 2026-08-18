export function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: toISODate(start), end: toISODate(end) };
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function parseRange(query) {
  const { start, end } = defaultRange();
  return {
    start: query.start || start,
    end: query.end || end,
    isFiltered: query.isFiltered === "true",
    campanha: query.campanha || null,
    veiculo: query.veiculo || null,
    modeloCompra: query.modeloCompra || null,
  };
}

export function isWithinRange(dateStr, start, end) {
  return dateStr >= start && dateStr <= end;
}

// Retorna o periodo imediatamente anterior, com a mesma duracao em dias do periodo recebido.
// Ex: start=2026-06-20 end=2026-06-22 (3 dias) -> start=2026-06-17 end=2026-06-19.
export function previousEquivalentRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (durationDays - 1));

  return { start: toISODate(prevStart), end: toISODate(prevEnd) };
}

// Quando nenhum filtro de periodo e aplicado pelo usuario, o CTR compara os ultimos 3 dias.
export function defaultCtrRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 2);
  return { start: toISODate(start), end: toISODate(end) };
}
