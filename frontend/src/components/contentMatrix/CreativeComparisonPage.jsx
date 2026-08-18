import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCreativeSeries } from "../../api/client.js";
import Spinner from "../common/Spinner.jsx";
import useIsMobile from "../../hooks/useIsMobile.js";

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function formatCompact(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return (value || 0).toLocaleString("pt-BR");
}

function formatDateBR(iso) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const EMPTY_FILTERS = {};

const CORES = ["#2f6feb", "#16a34a", "#f59e0b", "#a855f7", "#dc2626", "#0891b2"];

const METRICAS_GRAFICO = [
  { key: "impressoes", label: "Impressões" },
  { key: "cliques", label: "Cliques" },
  { key: "videoViews", label: "Visualizações" },
  { key: "investimento", label: "Investimento" },
  { key: "leads", label: "Leads" },
  { key: "sessoes", label: "Sessões" },
];

// Padroes de traco (uma linha solida, as demais tracejadas com passos diferentes)
// para diferenciar metricas quando mais de uma esta selecionada -- a cor ja
// identifica o criativo, o tracejado identifica a metrica.
const TRACOS = ["0", "6 3", "2 3", "8 3 2 3"];

const METRIC_ROWS = [
  { key: "investimento", label: "Investimento", format: (v) => `R$ ${(v || 0).toLocaleString("pt-BR")}` },
  { key: "impressoes", label: "Impressões", format: formatCompact },
  { key: "cliques", label: "Cliques", format: formatCompact },
  { key: "ctr", label: "CTR", format: (v) => `${v || 0}%` },
  { key: "sessoes", label: "Sessões", format: formatCompact },
  { key: "leads", label: "Leads", format: formatCompact },
];

function melhorIndice(totais, key) {
  const valores = totais.map((t) => t?.[key]);
  const positivos = valores.filter((v) => typeof v === "number" && v > 0);
  if (positivos.length === 0) return -1;
  return valores.indexOf(Math.max(...positivos));
}

function diffPercent(valor, referencia) {
  if (!referencia || typeof valor !== "number") return null;
  return ((valor - referencia) / referencia) * 100;
}

// Comparativo de 2+ criativos DENTRO da mesma campanha -- mesmo padrao visual/tecnico
// do Comparativo de Campanhas (CampaignComparisonPage.jsx), adaptado: a "Visao geral"
// usa dados ja carregados em memoria (performanceMap, buscado em lote pela view que
// abriu o comparativo), so o grafico de evolucao precisa de fetch adicional (uma
// serie por criativo, via getCreativeSeries).
export default function CreativeComparisonPage({ creatives, performanceMap, campanhaId, onVoltar }) {
  const [series, setSeries] = useState(null);
  const [metricasGrafico, setMetricasGrafico] = useState(["impressoes"]);
  const isMobile = useIsMobile();

  function toggleMetricaGrafico(key) {
    setMetricasGrafico((prev) => {
      if (prev.includes(key)) return prev.length === 1 ? prev : prev.filter((k) => k !== key);
      return [...prev, key];
    });
  }

  const chaveCreatives = creatives.map((c) => c.id).join(",");

  useEffect(() => {
    setSeries(null);
    Promise.all(
      creatives.map((c) =>
        c.ad_name ? getCreativeSeries(campanhaId, c.plataforma, c.ad_name, EMPTY_FILTERS).catch(() => []) : Promise.resolve([])
      )
    ).then(setSeries);
  }, [chaveCreatives]);

  const totais = creatives.map((c) => performanceMap[c.id] || null);

  const chartData = (() => {
    if (!series) return [];
    const byDate = new Map();
    series.forEach((serieItem, i) => {
      for (const ponto of serieItem) {
        if (!byDate.has(ponto.data)) byDate.set(ponto.data, { data: ponto.data });
        for (const metrica of metricasGrafico) {
          byDate.get(ponto.data)[`item${i}_${metrica}`] = ponto[metrica];
        }
      }
    });
    return [...byDate.values()].sort((a, b) => (a.data < b.data ? -1 : 1));
  })();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Comparativo de criativos</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onVoltar}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
              border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-primary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            <CloseIcon /> Fechar comparativo
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, overflowX: isMobile ? undefined : "auto" }}>
        <p className="card-title">Visão geral</p>
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {creatives.map((c, i) => {
              const total = totais[i];
              const referencia = totais[0];
              return (
                <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: CORES[i % CORES.length], flexShrink: 0 }} />
                    <strong style={{ fontSize: 13 }}>{c.nome}</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", rowGap: 6, columnGap: 10 }}>
                    {METRIC_ROWS.map((m) => {
                      const melhor = melhorIndice(totais, m.key);
                      const diff = i > 0 ? diffPercent(total?.[m.key], referencia?.[m.key]) : null;
                      return (
                        <div key={m.key} style={{ display: "contents" }}>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.label}</span>
                          <span style={{ fontSize: 12, fontWeight: i === melhor ? 700 : 400, color: i === melhor ? "var(--success)" : "var(--text-primary)", textAlign: "right" }}>
                            {m.format(total?.[m.key])}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, textAlign: "right", color: diff !== null && Number.isFinite(diff) ? (diff >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-secondary)" }}>
                            {i === 0 ? "" : diff !== null && Number.isFinite(diff) ? `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}%` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Métrica</th>
                {creatives.map((c, i) => (
                  <th key={c.id} colSpan={i > 0 ? 2 : 1}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: CORES[i % CORES.length] }} />
                      {c.nome}
                    </span>
                  </th>
                ))}
              </tr>
              <tr>
                {creatives.map((c, i) =>
                  i > 0 ? (
                    <>
                      <th key={`${c.id}-v`} style={{ fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>Valor</th>
                      <th key={`${c.id}-d`} style={{ fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>Diferença</th>
                    </>
                  ) : (
                    <th key={c.id} />
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map((m) => {
                const melhor = melhorIndice(totais, m.key);
                const referencia = totais[0]?.[m.key];
                return (
                  <tr key={m.key}>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{m.label}</td>
                    {totais.map((total, i) => {
                      const diff = i > 0 ? diffPercent(total?.[m.key], referencia) : null;
                      const valorStyle = { fontWeight: i === melhor ? 700 : 400, color: i === melhor ? "var(--success)" : "var(--text-primary)" };
                      if (i === 0) return <td key={creatives[i].id} style={valorStyle}>{m.format(total?.[m.key])}</td>;
                      return (
                        <>
                          <td key={`${creatives[i].id}-v`} style={valorStyle}>{m.format(total?.[m.key])}</td>
                          <td
                            key={`${creatives[i].id}-d`}
                            style={{ fontSize: 12, fontWeight: 600, color: diff !== null && Number.isFinite(diff) ? (diff >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-secondary)" }}
                          >
                            {diff !== null && Number.isFinite(diff) ? `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}%` : "—"}
                          </td>
                        </>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <p className="card-title" style={{ margin: 0 }}>Evolução</p>
          <div style={{ display: "flex", gap: 6 }}>
            {METRICAS_GRAFICO.map((m) => {
              const ativa = metricasGrafico.includes(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMetricaGrafico(m.key)}
                  style={{
                    border: `1px solid ${ativa ? "var(--accent)" : "var(--border)"}`,
                    background: ativa ? "var(--accent)" : "transparent",
                    color: ativa ? "#fff" : "var(--text-secondary)",
                    borderRadius: 999, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        {!series ? (
          <Spinner />
        ) : chartData.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sem dados de série para estes criativos.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="data" tickFormatter={formatDateBR} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompact} width={40} />
              <Tooltip
                labelFormatter={formatDateBR}
                contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {creatives.map((c, i) =>
                metricasGrafico.map((metrica, mi) => (
                  <Line
                    key={`${c.id}_${metrica}`}
                    type="monotone"
                    dataKey={`item${i}_${metrica}`}
                    name={metricasGrafico.length > 1 ? `${c.nome} · ${METRICAS_GRAFICO.find((m) => m.key === metrica)?.label}` : c.nome}
                    stroke={CORES[i % CORES.length]}
                    strokeDasharray={TRACOS[mi % TRACOS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
