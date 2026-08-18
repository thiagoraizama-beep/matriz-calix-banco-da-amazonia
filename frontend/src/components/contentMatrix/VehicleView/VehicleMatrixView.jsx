import { useEffect, useState } from "react";
import { getMatrixCreatives, getCreativesByCampanha, updateMatrixCreativeStatus, getPerformancePorCampanha } from "../../../api/client.js";
import { STATUS_OPTIONS_VEICULO } from "../statusBadge.jsx";
import CreativeCardGrid from "../CreativeCardGrid.jsx";
import CreativeGridCard from "../CreativeGridCard.jsx";
import CreativeFusedDetailModal from "../CreativeFusedDetailModal.jsx";
import CreativeComparisonPage from "../CreativeComparisonPage.jsx";
import MatrixMobileHeader from "../MatrixMobileHeader.jsx";
import { useMatrixFilters } from "../useMatrixFilters.js";
import { groupByStatus } from "../statusCounts.js";
import Spinner from "../../common/Spinner.jsx";
import useIsMobile from "../../../hooks/useIsMobile.js";
import { isUrgente } from "../../../utils/urgencia.js";

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function VehicleMatrixView({ campanhaId } = {}) {
  const [creatives, setCreatives] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [performanceMap, setPerformanceMap] = useState({});
  const [comparando, setComparando] = useState(false);
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const { filtered, options, filters, setStatus, setVeiculo, setCampanha, setPlataforma, setModeloCompra } = useMatrixFilters(creatives);
  const isMobile = useIsMobile();
  const statusCounts = creatives ? groupByStatus(creatives) : {};

  function load() {
    setCreatives(null);
    const request = campanhaId ? getCreativesByCampanha(campanhaId) : getMatrixCreatives();
    request.then(setCreatives).catch(console.error);
    if (campanhaId) {
      getPerformancePorCampanha(campanhaId).then(setPerformanceMap).catch(() => setPerformanceMap({}));
    }
  }

  useEffect(() => { load(); }, [campanhaId]);

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      await updateMatrixCreativeStatus(id, status);
      setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    } finally {
      setUpdatingId(null);
    }
  }

  function toggleSelect(id) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleCompararClick() {
    if (comparando) { setComparando(false); setSelecionados([]); return; }
    setComparando(true);
  }

  if (comparativoAberto) {
    return (
      <CreativeComparisonPage
        creatives={creatives.filter((c) => selecionados.includes(c.id))}
        performanceMap={performanceMap}
        campanhaId={campanhaId}
        onVoltar={() => setComparativoAberto(false)}
      />
    );
  }

  const compareButton = campanhaId && creatives?.length >= 2 && (
    <button
      onClick={handleCompararClick}
      style={{
        padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: comparando ? "none" : "1px solid var(--border)",
        background: comparando ? "var(--accent)" : "transparent",
        color: comparando ? "#fff" : "var(--text-primary)",
      }}
    >
      {comparando ? `Cancelar seleção (${selecionados.length})` : "Selecionar para comparar"}
    </button>
  );

  const abrirComparativoButton = comparando && selecionados.length >= 2 && (
    <button
      onClick={() => setComparativoAberto(true)}
      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      Comparar agora ({selecionados.length})
    </button>
  );

  const statusGrid = creatives && (
    <div className="grid status-grid-4" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
      {Object.entries(statusCounts).map(([status, count]) => (
        <div className="card" key={status}>
          <p className="card-title">{status}</p>
          <p className="kpi-value">{count}</p>
        </div>
      ))}
    </div>
  );

  const criativosUrgentes = filtered.filter((c) => isUrgente(c.periodo_inicio));
  const filteredOrdenado = [...filtered].sort((a, b) => isUrgente(b.periodo_inicio) - isUrgente(a.periodo_inicio));

  const urgenciaBanner = criativosUrgentes.length > 0 && (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 16,
        borderRadius: 10, border: "1px solid rgba(199,127,26,0.35)", background: "rgba(199,127,26,0.1)", color: "#c77f1a",
      }}
    >
      <WarningIcon />
      <strong style={{ fontSize: 13.5 }}>
        {criativosUrgentes.length} criativo{criativosUrgentes.length === 1 ? "" : "s"} precisa{criativosUrgentes.length === 1 ? "" : "m"} ser implementado{criativosUrgentes.length === 1 ? "" : "s"} hoje ou amanhã.
      </strong>
    </div>
  );

  const grid = !creatives ? <Spinner /> : (
    <>
      <CreativeCardGrid>
        {filteredOrdenado.map((c) => (
          <CreativeGridCard
            key={c.id}
            creative={c}
            urgente={isUrgente(c.periodo_inicio)}
            onOpenDetail={setViewing}
            canEdit={false}
            statusOptions={STATUS_OPTIONS_VEICULO}
            onStatusChange={handleStatusChange}
            updatingStatus={updatingId === c.id}
            performance={performanceMap[c.id]}
            selectable={comparando}
            selected={selecionados.includes(c.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </CreativeCardGrid>
      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: 12 }}>
          {creatives.length === 0 ? "Nenhum criativo cadastrado para o seu veículo ainda" : "Nenhum criativo encontrado para os filtros selecionados"}
        </div>
      )}
    </>
  );

  const modal = viewing && <CreativeFusedDetailModal creative={viewing} campanhaId={campanhaId} onClose={() => setViewing(null)} />;

  if (isMobile) {
    return (
      <div>
        <MatrixMobileHeader options={options} filters={filters} setStatus={setStatus} setVeiculo={setVeiculo} setCampanha={setCampanha} setPlataforma={setPlataforma} setModeloCompra={setModeloCompra} />
        <h2 style={{ margin: "16px 0" }}>Meus Criativos</h2>
        {campanhaId && <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>{compareButton}{abrirComparativoButton}</div>}
        {urgenciaBanner}
        {statusGrid}
        {grid}
        {modal}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 20 }}>
      {campanhaId && <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>{compareButton}{abrirComparativoButton}</div>}
      {urgenciaBanner}
      {statusGrid}
      {grid}
      {modal}
    </div>
  );
}
