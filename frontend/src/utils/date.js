export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// new Date("YYYY-MM-DD") interpreta a string como UTC meia-noite, o que em fusos
// negativos (ex: Brasil, UTC-3) volta para o dia anterior no horario local. Esta
// funcao monta a data a partir dos componentes, sempre no fuso local.
export function fromISODate(iso) {
  if (!iso) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}
