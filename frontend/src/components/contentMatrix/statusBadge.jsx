export const STATUS_COLORS = {
  "Não registrado":           { color: "var(--text-secondary)", bg: "var(--border)" },
  "Com erro":                 { color: "var(--danger)",         bg: "rgba(220,38,38,0.12)" },
  Programado:                 { color: "var(--accent)",         bg: "var(--accent-soft)" },
  Pausado:                    { color: "var(--text-secondary)", bg: "var(--border)" },
  "Em aprovação":             { color: "#b45309",               bg: "rgba(180,83,9,0.12)" },
  Aprovado:                   { color: "var(--success)",        bg: "rgba(22,163,74,0.12)" },
  "Aguardando implementação": { color: "#7c3aed",               bg: "rgba(124,58,237,0.1)" },
  Ativo:                      { color: "var(--success)",        bg: "rgba(22,163,74,0.12)" },
  Finalizado:                 { color: "var(--text-secondary)", bg: "var(--border)" },
};

export const STATUS_OPTIONS_AGENCIA = [
  "Não registrado",
  "Em aprovação",
  "Aprovado",
  "Aguardando implementação",
  "Programado",
  "Ativo",
  "Pausado",
  "Com erro",
  "Finalizado",
];

export const STATUS_OPTIONS_VEICULO = [
  "Programado",
  "Ativo",
  "Pausado",
  "Com erro",
  "Finalizado",
];

export const STATUS_OPTIONS = STATUS_OPTIONS_AGENCIA;

// truncate: usado em espacos apertados (ex: card da grade com badge de
// urgencia + botoes ao lado) -- trunca o proprio texto com "..." em vez de
// deixar o badge inteiro estourar e empurrar os botoes de acao pra fora.
export default function StatusBadge({ status, truncate = false }) {
  const style = STATUS_COLORS[status] || { color: "var(--text-secondary)", bg: "var(--border)" };
  return (
    <span
      title={truncate ? status : undefined}
      style={{
        display: "inline-block",
        maxWidth: truncate ? "100%" : undefined,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: truncate ? "hidden" : undefined,
        textOverflow: truncate ? "ellipsis" : undefined,
        boxSizing: "border-box",
        color: style.color,
        background: style.bg,
      }}
    >
      {status}
    </span>
  );
}

// Indicador compacto (bolinha colorida) para telas com pouco espaco -- mesmo
// mapa de cores do StatusBadge, sem o texto. O nome do status fica no title
// (tooltip nativo) para nao perder a informacao.
export function StatusDot({ status }) {
  const style = STATUS_COLORS[status] || { color: "var(--text-secondary)", bg: "var(--border)" };
  return (
    <span
      title={status || "Sem status"}
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: style.color,
        flexShrink: 0,
      }}
    />
  );
}
