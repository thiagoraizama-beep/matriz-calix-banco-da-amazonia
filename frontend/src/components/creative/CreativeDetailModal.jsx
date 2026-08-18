import CreativeEvolutionChart from "./CreativeEvolutionChart.jsx";
import StatusBadge from "../contentMatrix/statusBadge.jsx";

function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("pt-BR");
}

export default function CreativeDetailModal({ creative, campanhaId, veiculo, filters, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,33,61,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 1123, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <strong style={{ fontSize: 14 }}>{creative.nomeCriativo}</strong>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>{creative.adName}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-secondary)" }}
          >
            ×
          </button>
        </div>

        <div className="filter-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }}>
          <CreativeEvolutionChart campanhaId={campanhaId} veiculo={veiculo} adName={creative.adName || creative.nomeCriativo} filters={filters} />

          <div>
            {creative.imagemCriativo && (
              <div
                style={{
                  marginBottom: 20,
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "var(--bg)",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {creative.tipoMidia === "video" ? (
                  <video
                    src={creative.imagemCriativo}
                    controls
                    style={{ maxWidth: "100%", maxHeight: 280, width: "auto", height: "auto" }}
                    onError={(e) => {
                      if (creative.cloudinaryUrl && e.target.src !== creative.cloudinaryUrl) {
                        e.target.src = creative.cloudinaryUrl;
                      } else {
                        e.target.style.display = "none";
                      }
                    }}
                  />
                ) : (
                  <img
                    src={creative.imagemCriativo}
                    alt={creative.nomeCriativo}
                    style={{ maxWidth: "100%", maxHeight: 280, width: "auto", height: "auto", objectFit: "contain" }}
                    onError={(e) => {
                      if (creative.cloudinaryUrl && e.target.src !== creative.cloudinaryUrl) {
                        e.target.src = creative.cloudinaryUrl;
                      } else {
                        e.target.style.display = "none";
                      }
                    }}
                  />
                )}
              </div>
            )}

            <p className="card-title">Performance</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="card" style={{ background: "#fdecec" }}>
                <strong style={{ fontSize: 18, color: "var(--danger)" }}>
                  R$ {creative.investimento.toLocaleString("pt-BR")}
                </strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>Investimento</p>
              </div>
              <div className="card" style={{ background: "var(--accent-soft)" }}>
                <strong style={{ fontSize: 18, color: "var(--accent)" }}>{formatCompact(creative.impressoes)}</strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>Impressões</p>
              </div>
              <div className="card" style={{ background: "#e8f8ee" }}>
                <strong style={{ fontSize: 18, color: "var(--success)" }}>{formatCompact(creative.cliques)}</strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>Cliques</p>
              </div>
              <div className="card" style={{ background: "#f3e8fd" }}>
                <strong style={{ fontSize: 18, color: "#9333ea" }}>{creative.ctr}%</strong>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>CTR</p>
              </div>
            </div>

            <p className="card-title" style={{ marginTop: 20 }}>
              Métricas Detalhadas
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <Row label="Tipo de Compra" value={creative.tipoCompra} />
              <Row label="Formato" value={creative.posicionamento} />
              <Row label="VTR" value={`${creative.vtr}%`} />
              <Row label="Visualizações de vídeo" value={formatCompact(creative.videoViews)} />
            </div>

            <div className="card" style={{ marginTop: 20, background: "var(--bg)" }}>
              <p className="card-title" style={{ margin: 0 }}>
                Informações do Criativo
              </p>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="Nome do Criativo" value={creative.nomeCriativo} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Status:</span>
                  {creative.status ? <StatusBadge status={creative.status} /> : <strong>-</strong>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
