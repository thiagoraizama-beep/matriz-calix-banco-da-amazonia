// Extrai o ID da planilha de uma URL colada inteira (ex:
// https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0) ou aceita o ID puro.
export function extrairSpreadsheetId(value) {
  const trimmed = (value || "").trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}
