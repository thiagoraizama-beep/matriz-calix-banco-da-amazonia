export default function KpiCard({ label, value, change, footer, compact }) {
  return (
    <div className="card">
      <p className="card-title">{label}</p>
      <p className={compact ? "kpi-value-compact" : "kpi-value"}>{value}</p>
      {change != null && (
        <span style={{ color: change >= 0 ? "var(--success)" : "var(--danger)", fontSize: 13, fontWeight: 600 }}>
          {change >= 0 ? "+" : ""}
          {change}%
        </span>
      )}
      {footer}
    </div>
  );
}
