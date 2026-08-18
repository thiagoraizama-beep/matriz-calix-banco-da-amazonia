import { useMemo, useState } from "react";
import ThemeToggle from "../components/layout/ThemeToggle.jsx";
import SimpleDateRangeFields from "../components/layout/SimpleDateRangeFields.jsx";
import { STATUS_LABEL, STATUS_BADGE_CLASS, periodoIntersecta } from "../utils/campanhaStatus.js";
import CampaignComparisonPage from "./CampaignComparisonPage.jsx";

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

// item: { tipo: "campanha", campanhaId, campanhaNome, status } ou
//       { tipo: "plataforma", campanhaId, campanhaNome, veiculo }
function itemKey(item) {
  return item.tipo === "campanha" ? `c:${item.campanhaId}` : `p:${item.campanhaId}:${item.veiculo}`;
}

export default function CampaignComparisonSetupPage({ campanhas, onVoltar }) {
  const [selecionados, setSelecionados] = useState([]);
  const [expandidas, setExpandidas] = useState([]);
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState(null);
  const [periodoFim, setPeriodoFim] = useState(null);

  const campanhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return campanhas.filter((c) => {
      const bateBusca = !termo || c.campanhaNome.toLowerCase().includes(termo);
      const batePeriodo = periodoIntersecta(c.dataInicio, c.dataFim, periodoInicio, periodoFim);
      return bateBusca && batePeriodo;
    });
  }, [campanhas, busca, periodoInicio, periodoFim]);

  function toggleExpandida(campanhaId) {
    setExpandidas((prev) => (prev.includes(campanhaId) ? prev.filter((id) => id !== campanhaId) : [...prev, campanhaId]));
  }

  function toggleItem(item) {
    const key = itemKey(item);
    setSelecionados((prev) => (prev.some((i) => itemKey(i) === key) ? prev.filter((i) => itemKey(i) !== key) : [...prev, item]));
  }

  function isSelecionado(item) {
    return selecionados.some((i) => itemKey(i) === itemKey(item));
  }

  if (comparativoAberto) {
    return <CampaignComparisonPage itens={selecionados} onVoltar={onVoltar} />;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Montar comparativo</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setComparativoAberto(true)}
            disabled={selecionados.length < 2}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: selecionados.length < 2 ? "not-allowed" : "pointer",
              opacity: selecionados.length < 2 ? 0.5 : 1,
            }}
          >
            Ver comparativo ({selecionados.length})
          </button>
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
          <ThemeToggle variant="plain" />
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 16px" }}>
        Marque a campanha inteira, ou expanda e marque só as plataformas que quiser comparar. Misture como preferir.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              flex: 1,
              minWidth: 220,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "9px 12px",
            }}
          >
            <span style={{ color: "var(--text-secondary)", display: "flex" }}>
              <SearchIcon />
            </span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar campanha..."
              list="comparativo-campanhas-autocomplete"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text-primary)", width: "100%" }}
            />
            <datalist id="comparativo-campanhas-autocomplete">
              {campanhas.map((c) => (
                <option key={c.campanhaId} value={c.campanhaNome} />
              ))}
            </datalist>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SimpleDateRangeFields
              start={periodoInicio}
              end={periodoFim}
              onChange={(s, e) => { setPeriodoInicio(s); setPeriodoFim(e); }}
            />
            {periodoInicio && periodoFim && (
              <button
                onClick={() => { setPeriodoInicio(null); setPeriodoFim(null); }}
                title="Limpar período"
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, flexShrink: 0 }}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {campanhasFiltradas.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 4px" }}>Nenhuma campanha encontrada.</p>
        )}
        {campanhasFiltradas.map((c) => {
          const itemCampanha = { tipo: "campanha", campanhaId: c.campanhaId, campanhaNome: c.campanhaNome, status: c.status };
          const campanhaMarcada = isSelecionado(itemCampanha);
          const expandida = expandidas.includes(c.campanhaId);
          return (
            <div key={c.campanhaId} style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                  <span
                    onClick={() => toggleItem(itemCampanha)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: `1px solid ${campanhaMarcada ? "var(--accent)" : "var(--border)"}`,
                      background: campanhaMarcada ? "var(--accent)" : "transparent",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {campanhaMarcada && <CheckIcon />}
                  </span>
                  <span onClick={() => toggleItem(itemCampanha)} style={{ fontSize: 13, fontWeight: 600 }}>
                    {c.campanhaNome}
                  </span>
                  {c.status && (
                    <span className={`badge ${STATUS_BADGE_CLASS[c.status] || "badge-ativo"}`} style={{ fontSize: 10 }}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  )}
                </label>
                <button
                  onClick={() => toggleExpandida(c.campanhaId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Plataformas <ChevronIcon open={expandida} />
                </button>
              </div>

              {expandida && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 4px 12px 32px" }}>
                  {c.plataformas.map((veiculo) => {
                    const itemPlataforma = { tipo: "plataforma", campanhaId: c.campanhaId, campanhaNome: c.campanhaNome, veiculo };
                    const marcada = isSelecionado(itemPlataforma);
                    return (
                      <button
                        key={veiculo}
                        onClick={() => toggleItem(itemPlataforma)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--accent)",
                          background: marcada ? "var(--accent)" : "transparent",
                          color: marcada ? "#fff" : "var(--accent)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {marcada && <CheckIcon />}
                        {veiculo}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
