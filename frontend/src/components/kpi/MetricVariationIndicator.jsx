function getColors(variacao) {
  if (variacao > 0) return { color: "var(--success)", background: "#e8f8ee" };
  if (variacao >= -2) return { color: "#f59e0b", background: "#fef3e2" };
  return { color: "var(--danger)", background: "#fdecec" };
}

export default function MetricVariationIndicator({ label, value, variacao }) {
  const hasVariacao = variacao != null;
  const { color, background } = hasVariacao ? getColors(variacao) : {};
  const sign = hasVariacao && variacao > 0 ? "+" : "";
  const arrow = hasVariacao ? (variacao > 0 ? "↑" : variacao < 0 ? "↓" : "") : "";

  return (
    <p style={{ fontSize: 11, margin: "14px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
      {hasVariacao && (
        <span
          style={{
            color,
            background,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {arrow} {sign}
          {variacao}%
        </span>
      )}
      <span style={{ color: "var(--text-secondary)" }}>
        {label != null && value != null ? `${label} ${value.toFixed(2)}%` : "vs período anterior"}
      </span>
    </p>
  );
}
