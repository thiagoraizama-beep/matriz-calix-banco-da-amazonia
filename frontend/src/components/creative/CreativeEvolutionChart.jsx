import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getCreativeSeries } from "../../api/client.js";
import Spinner from "../common/Spinner.jsx";

// Paleta institucional do Banco da Amazonia (mesmos tons do Avatar.jsx) --
// todas as metricas em variacoes de verde/terroso da marca, sem vermelho ou
// laranja genericos.
const METRICS = [
  { key: "cliques", label: "Cliques", color: "#0B6E4F" },
  { key: "impressoes", label: "Impressões", color: "#1E9C6B" },
  { key: "videoViews", label: "Visualizações", color: "#00695C" },
  { key: "investimento", label: "Investimento", color: "#4E6B4A" },
  { key: "leads", label: "Leads", color: "#2E7D32" },
  { key: "sessoes", label: "Sessões", color: "#003D2A" },
];

function formatDateBR(iso) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export default function CreativeEvolutionChart({ campanhaId, veiculo, adName, filters }) {
  const [metric, setMetric] = useState("impressoes");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    getCreativeSeries(campanhaId, veiculo, adName, filters).then(setData).catch(console.error);
  }, [
    campanhaId,
    veiculo,
    adName,
    filters.start,
    filters.end,
    JSON.stringify(filters.tipoCompra),
    JSON.stringify(filters.posicionamento),
    JSON.stringify(filters.plataforma),
  ]);

  const selected = METRICS.find((m) => m.key === metric);

  return (
    <div
      style={{
        background: "var(--bg)",
        borderRadius: 12,
        padding: 16,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 5 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            color: selected.color,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "color 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
          }}
        >
          {selected.label}
          <span style={{ fontSize: 10, transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>▾</span>
        </button>
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(20,33,61,0.1)",
              overflow: "hidden",
              minWidth: 140,
              animation: "creativeMetricDropdownIn 0.16s ease-out",
              transformOrigin: "top right",
            }}
          >
            {METRICS.map((m) => (
              <div
                key={m.key}
                onClick={() => {
                  setMetric(m.key);
                  setOpen(false);
                }}
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: m.key === metric ? m.color : "var(--text-primary)",
                  fontWeight: m.key === metric ? 600 : 400,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {m.label}
              </div>
            ))}
          </div>
        )}
        <style>{`
          @keyframes creativeMetricDropdownIn {
            from { opacity: 0; transform: scale(0.96) translateY(-4px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 30, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="creativeMetricFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={selected.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={selected.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="data" tickFormatter={formatDateBR} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              labelFormatter={formatDateBR}
              formatter={(value) => [value.toLocaleString("pt-BR"), selected.label]}
              contentStyle={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
              labelStyle={{ color: "var(--text-primary)" }}
              itemStyle={{ color: "var(--text-primary)" }}
            />
            <Area
              key={metric}
              type="monotone"
              dataKey={metric}
              stroke={selected.color}
              strokeWidth={2}
              fill="url(#creativeMetricFill)"
              dot={false}
              isAnimationActive
              animationDuration={450}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
