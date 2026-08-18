// Aceita filtro como valor unico ou array (multi-selecao).
// null/undefined = sem filtro (ver tudo).
// [] (array vazio) = BLOQUEIO TOTAL — nao bate em nenhuma linha.
// Isso permite que o sistema de scoping use [] para "sem permissao".
export function matchesFilter(rowValue, filterValue) {
  if (filterValue === null || filterValue === undefined) return true;
  if (Array.isArray(filterValue)) {
    if (filterValue.length === 0) return false; // [] = bloqueado
    return filterValue.includes(rowValue);
  }
  return rowValue === filterValue;
}

// Normaliza um filtro (valor unico ou array) numa lista de valores.
// null/undefined -> null (sem filtro).
// [] -> [] (bloqueio total, preservado).
export function toFilterList(filterValue) {
  if (filterValue === null || filterValue === undefined) return null;
  if (Array.isArray(filterValue)) return filterValue; // preserva [], nao converte para null
  return [filterValue];
}
