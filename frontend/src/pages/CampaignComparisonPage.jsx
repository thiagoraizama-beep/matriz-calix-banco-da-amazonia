import { Fragment, useEffect, useState } from "react";
import {
  getCampanhaSummary,
  getCampanhaSeries,
  getCreativeSummary,
  getPlataformaSeries,
} from "../api/client.js";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Spinner from "../components/common/Spinner.jsx";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "../utils/campanhaStatus.js";
import useIsMobile from "../hooks/useIsMobile.js";

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return (value || 0).toLocaleString("pt-BR");
}

function formatDateBR(iso) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const EMPTY_FILTERS = { start: null, end: null, tipoCompra: null, posicionamento: null, plataforma: null };

const CORES = ["#2f6feb", "#16a34a", "#f59e0b", "#a855f7", "#dc2626", "#0891b2"];

const METRICAS_GRAFICO = [
  { key: "impressoes", label: "Impressões" },
  { key: "cliques", label: "Cliques" },
  { key: "videoViews", label: "Visualizações" },
  { key: "leads", label: "Leads" },
  { key: "sessoes", label: "Sessões" },
  { key: "investimento", label: "Investimento" },
];

// Padroes de traco (uma linha solida, as demais tracejadas com passos diferentes)
// para diferenciar metricas quando mais de uma esta selecionada -- a cor ja
// identifica o item, o tracejado identifica a metrica.
const TRACOS = ["0", "6 3", "2 3", "8 3 2 3"];

const METRIC_ROWS = [
  { key: "investimento", label: "Investimento", format: (v) => `R$ ${(v || 0).toLocaleString("pt-BR")}` },
  { key: "impressoes", label: "Impressões", format: formatCompact },
  { key: "alcance", label: "Alcance", format: formatCompact },
  { key: "cliques", label: "Cliques", format: formatCompact },
  { key: "ctr", label: "CTR", format: (v) => `${v || 0}%` },
  { key: "cpm", label: "CPM", format: (v) => `R$ ${(v || 0).toLocaleString("pt-BR")}` },
  { key: "cpc", label: "CPC", format: (v) => `R$ ${(v || 0).toLocaleString("pt-BR")}` },
  { key: "frequencia", label: "Frequência", format: (v) => (v || 0).toFixed(2) },
];

const LOWER_IS_BETTER = new Set(["cpm", "cpc"]);

function melhorIndice(totais, key) {
  const valores = totais.map((t) => t?.[key] ?? 0);
  const positivos = valores.filter((v) => v > 0);
  if (positivos.length === 0) return -1;
  const alvo = LOWER_IS_BETTER.has(key) ? Math.min(...positivos) : Math.max(...positivos);
  return valores.indexOf(alvo);
}

// Diferenca percentual de cada item em relacao ao primeiro (referencia).
function diffPercent(valor, referencia) {
  if (!referencia) return null;
  return ((valor - referencia) / referencia) * 100;
}

function itemLabel(item) {
  return item.tipo === "campanha" ? item.campanhaNome : `${item.campanhaNome} · ${item.veiculo}`;
}

export default function CampaignComparisonPage({ itens, onVoltar }) {
  const [resultados, setResultados] = useState(null);
  const [series, setSeries] = useState(null);
  const [metricasGrafico, setMetricasGrafico] = useState(["impressoes"]);
  const isMobile = useIsMobile();

  function toggleMetricaGrafico(key) {
    setMetricasGrafico((prev) => {
      if (prev.includes(key)) return prev.length === 1 ? prev : prev.filter((k) => k !== key);
      return [...prev, key];
    });
  }

  const chaveItens = itens.map((i) => (i.tipo === "campanha" ? `c:${i.campanhaId}` : `p:${i.campanhaId}:${i.veiculo}`)).join(",");

  useEffect(() => {
    setResultados(null);
    setSeries(null);
    Promise.all(
      itens.map((item) =>
        item.tipo === "campanha"
          ? getCampanhaSummary(item.campanhaId)
              .then((r) => ({ total: r.total, plataformas: r.porPlataforma }))
              .catch(() => null)
          : getCreativeSummary(item.campanhaId, item.veiculo, EMPTY_FILTERS)
              .then((total) => ({ total, plataformas: { [item.veiculo]: total } }))
              .catch(() => null)
      )
    ).then(setResultados);

    Promise.all(
      itens.map((item) =>
        item.tipo === "campanha"
          ? getCampanhaSeries(item.campanhaId).catch(() => [])
          : getPlataformaSeries(item.campanhaId, item.veiculo).catch(() => [])
      )
    ).then(setSeries);
  }, [chaveItens]);

  const todasPlataformas = resultados
    ? [...new Set(itens.flatMap((item, i) => (item.tipo === "campanha" ? Object.keys(resultados[i]?.plataformas || {}) : [item.veiculo])))]
    : [];

  // Junta as series de cada item num unico dataset por data, prefixando a chave da metrica com o indice do item.
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

  const donutData = resultados
    ? itens.map((item, i) => ({ name: itemLabel(item), value: resultados[i]?.total?.investimento || 0 }))
    : [];
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Comparativo</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onVoltar}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <CloseIcon /> Fechar comparativo
          </button>
        </div>
      </div>

      {!resultados ? (
        <div className="card">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Visão geral com diferença percentual */}
          <div className="card" style={{ marginBottom: 16, overflowX: isMobile ? undefined : "auto" }}>
            <p className="card-title">Visão geral</p>
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {itens.map((item, i) => {
                  const total = resultados[i]?.total;
                  const referencia = resultados[0]?.total;
                  return (
                    <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CORES[i % CORES.length], flexShrink: 0 }} />
                        <strong style={{ fontSize: 13 }}>{itemLabel(item)}</strong>
                      </div>
                      {item.tipo === "campanha" && item.status && (
                        <span className={`badge ${STATUS_BADGE_CLASS[item.status] || "badge-ativo"}`} style={{ fontSize: 10, marginBottom: 8, display: "inline-block" }}>
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", rowGap: 6, columnGap: 10, marginTop: 6 }}>
                        {METRIC_ROWS.map((m) => {
                          const totaisTodos = resultados.map((r) => r?.total);
                          const melhor = melhorIndice(totaisTodos, m.key);
                          const diff = i > 0 ? diffPercent(total?.[m.key] ?? 0, referencia?.[m.key]) : null;
                          return (
                            <Fragment key={m.key}>
                              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.label}</span>
                              <span style={{ fontSize: 12, fontWeight: i === melhor ? 700 : 400, color: i === melhor ? "var(--success)" : "var(--text-primary)", textAlign: "right" }}>
                                {m.format(total?.[m.key])}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  textAlign: "right",
                                  color: diff !== null && Number.isFinite(diff) ? (diff >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-secondary)",
                                }}
                              >
                                {i === 0 ? "" : diff !== null && Number.isFinite(diff) ? `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}%` : "—"}
                              </span>
                            </Fragment>
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
                  {itens.map((item, i) => (
                    <th key={i} colSpan={i > 0 ? 2 : 1}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: CORES[i % CORES.length] }} />
                          {itemLabel(item)}
                        </span>
                        {item.tipo === "campanha" && item.status && (
                          <span className={`badge ${STATUS_BADGE_CLASS[item.status] || "badge-ativo"}`} style={{ fontSize: 10 }}>
                            {STATUS_LABEL[item.status] || item.status}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  {itens.map((_, i) =>
                    i > 0 ? (
                      <Fragment key={i}>
                        <th style={{ fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>Valor</th>
                        <th style={{ fontSize: 10, fontWeight: 500, color: "var(--text-secondary)" }}>Diferença</th>
                      </Fragment>
                    ) : (
                      <th key={i} />
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map((m) => {
                  const totais = resultados.map((r) => r?.total);
                  const melhor = melhorIndice(totais, m.key);
                  const referencia = totais[0]?.[m.key];
                  return (
                    <tr key={m.key}>
                      <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{m.label}</td>
                      {totais.map((total, i) => {
                        const diff = i > 0 ? diffPercent(total?.[m.key] ?? 0, referencia) : null;
                        const valorStyle = {
                          fontWeight: i === melhor ? 700 : 400,
                          color: i === melhor ? "var(--success)" : "var(--text-primary)",
                        };
                        if (i === 0) {
                          return <td key={i} style={valorStyle}>{m.format(total?.[m.key])}</td>;
                        }
                        return (
                          <Fragment key={i}>
                            <td style={valorStyle}>{m.format(total?.[m.key])}</td>
                            <td
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: diff !== null && Number.isFinite(diff) ? (diff >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-secondary)",
                              }}
                            >
                              {diff !== null && Number.isFinite(diff) ? `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}%` : "—"}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>

          <div className="grid grid-bottom" style={{ marginBottom: 16 }}>
            {/* Gráfico de linhas */}
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
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 11,
                          cursor: "pointer",
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
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sem dados de série neste período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
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
                    {itens.map((item, i) =>
                      metricasGrafico.map((metrica, mi) => (
                        <Line
                          key={`${i}_${metrica}`}
                          type="monotone"
                          dataKey={`item${i}_${metrica}`}
                          name={metricasGrafico.length > 1 ? `${itemLabel(item)} · ${METRICAS_GRAFICO.find((m) => m.key === metrica)?.label}` : itemLabel(item)}
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

            {/* Gráfico de rosca */}
            <div className="card">
              <p className="card-title">Distribuição do investimento</p>
              {donutTotal === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sem investimento registrado.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={donutData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={CORES[i % CORES.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `R$ ${value.toLocaleString("pt-BR")}`}
                        contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                    {donutData.map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: CORES[i % CORES.length], flexShrink: 0 }} />
                        <span style={{ flex: 1, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                        <strong>{donutTotal > 0 ? `${((d.value / donutTotal) * 100).toFixed(1)}%` : "0%"}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {todasPlataformas.length > 0 && (
            <div className="card" style={{ overflowX: isMobile ? undefined : "auto" }}>
              <p className="card-title">Investimento por plataforma</p>
              {isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {itens.map((item, i) => (
                    <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CORES[i % CORES.length], flexShrink: 0 }} />
                        <strong style={{ fontSize: 13 }}>{itemLabel(item)}</strong>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {todasPlataformas.map((plataforma) => {
                          const valor = resultados[i]?.plataformas?.[plataforma]?.investimento;
                          const temPlataforma = valor !== undefined;
                          return (
                            <div key={plataforma} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "var(--text-secondary)" }}>{plataforma}</span>
                              <strong style={{ color: temPlataforma ? "var(--text-primary)" : "var(--text-secondary)" }}>
                                {temPlataforma ? `R$ ${(valor || 0).toLocaleString("pt-BR")}` : "—"}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <table>
                <thead>
                  <tr>
                    <th>Plataforma</th>
                    {itens.map((item, i) => (
                      <th key={i}>{itemLabel(item)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todasPlataformas.map((plataforma) => (
                    <tr key={plataforma}>
                      <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{plataforma}</td>
                      {resultados.map((r, i) => {
                        const valor = r?.plataformas?.[plataforma]?.investimento;
                        const temPlataforma = valor !== undefined;
                        return (
                          <td key={i} style={{ color: temPlataforma ? "var(--text-primary)" : "var(--text-secondary)" }}>
                            {temPlataforma ? `R$ ${(valor || 0).toLocaleString("pt-BR")}` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
