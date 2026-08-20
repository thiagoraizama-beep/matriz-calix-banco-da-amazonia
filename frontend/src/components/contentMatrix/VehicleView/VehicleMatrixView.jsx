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
import BulkEditHistoryPanel from "../AgencyView/BulkEditHistoryPanel.jsx";

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4l3 3" />
      <circle cx="12" cy="12" r="9" />
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
  const [bulkHistoryAberto, setBulkHistoryAberto] = useState(false);
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

  // Se o filtro de status estiver ativo e a troca fizer a lista filtrada
  // ficar vazia (o novo status nao bate mais com nenhum filtro marcado), o
  // filtro limpa sozinho -- senao a tela fica "filtrando a toa", vazia, sem o
  // usuario entender por que sumiu tudo so por ter mudado o status de 1 card.
  function limparFiltroStatusSeEsvaziou(novaLista) {
    if (filters.status.length === 0) return;
    const aindaTemAlgo = novaLista.some(
      (c) =>
        filters.status.includes(c.status) &&
        (filters.veiculo.length === 0 || filters.veiculo.includes(c.veiculo)) &&
        (filters.campanha.length === 0 || filters.campanha.includes(c.campanha)) &&
        (filters.plataforma.length === 0 || filters.plataforma.includes(c.plataforma)) &&
        (filters.modeloCompra.length === 0 || (c.tipos_compra || []).some((t) => filters.modeloCompra.includes(t)))
    );
    if (!aindaTemAlgo) setStatus([]);
  }

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      await updateMatrixCreativeStatus(id, status);
      setCreatives((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, status } : c));
        limparFiltroStatusSeEsvaziou(next);
        return next;
      });
    } finally {
      setUpdatingId(null);
    }
  }

  // Desmarcar o ultimo item selecionado sai automaticamente do modo de
  // comparacao -- antes o usuario ficava "preso" na barra de selecao mesmo
  // com 0 itens marcados, precisando clicar em "Cancelar seleção" a parte.
  function toggleSelect(id) {
    setSelecionados((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      if (next.length === 0) setComparando(false);
      return next;
    });
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

  // Cobre a troca de status individual (unica edicao que o veiculo faz) --
  // mesma janela de 2h pra desfazer, ver BulkEditHistoryPanel.jsx.
  const bulkHistoryButton = campanhaId && creatives?.length >= 1 && (
    <button
      onClick={() => setBulkHistoryAberto(true)}
      title="Últimas edições"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999,
        border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0,
      }}
    >
      <HistoryIcon />
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
  const bulkHistoryPanel = bulkHistoryAberto && <BulkEditHistoryPanel onClose={() => setBulkHistoryAberto(false)} onUndone={load} />;

  if (isMobile) {
    return (
      <div>
        <MatrixMobileHeader options={options} filters={filters} setStatus={setStatus} setVeiculo={setVeiculo} setCampanha={setCampanha} setPlataforma={setPlataforma} setModeloCompra={setModeloCompra} />
        <h2 style={{ margin: "16px 0" }}>Meus Criativos</h2>
        {campanhaId && <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>{compareButton}{abrirComparativoButton}{bulkHistoryButton}</div>}
        {urgenciaBanner}
        {statusGrid}
        {grid}
        {modal}
        {bulkHistoryPanel}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 20 }}>
      {campanhaId && <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>{compareButton}{abrirComparativoButton}{bulkHistoryButton}</div>}
      {urgenciaBanner}
      {statusGrid}
      {grid}
      {modal}
      {bulkHistoryPanel}
    </div>
  );
}
