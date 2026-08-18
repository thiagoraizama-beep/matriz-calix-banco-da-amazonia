export function groupByStatus(creatives) {
  const groups = {};
  for (const c of creatives) {
    if (!c.status) continue;
    groups[c.status] = (groups[c.status] || 0) + 1;
  }
  return groups;
}

// Mesma logica de groupByStatus, mas agrupa os objetos inteiros em vez de so
// contar -- usado pelo KanbanBoard pra montar as colunas com os cards de
// verdade. items sem status (nao deveria acontecer, mas por seguranca) sao
// ignorados, mesmo criterio de groupByStatus.
export function groupItemsByStatus(items) {
  const groups = {};
  for (const item of items) {
    if (!item.status) continue;
    if (!groups[item.status]) groups[item.status] = [];
    groups[item.status].push(item);
  }
  return groups;
}
