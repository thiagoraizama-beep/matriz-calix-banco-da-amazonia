import { useEffect, useState } from "react";
import { getMatrixCreatives, getCreativesByCampanha, getPerformancePorCampanha } from "../../../api/client.js";
import CreativeCardGrid from "../CreativeCardGrid.jsx";
import CreativeGridCard from "../CreativeGridCard.jsx";
import CreativeFusedDetailModal from "../CreativeFusedDetailModal.jsx";
import CreativeComparisonPage from "../CreativeComparisonPage.jsx";
import MatrixMobileHeader from "../MatrixMobileHeader.jsx";
import { useMatrixFilters } from "../useMatrixFilters.js";
import { groupByStatus } from "../statusCounts.js";
import Spinner from "../../common/Spinner.jsx";
import useIsMobile from "../../../hooks/useIsMobile.js";
import KanbanBoard from "../../common/KanbanBoard.jsx";
import { STATUS_COLORS } from "../statusBadge.jsx";
import { useMatrixFiltersContext } from "../../../context/MatrixFiltersContext.jsx";

export default function ClientMatrixView({ campanhaId } = {}) {
  const [creatives, setCreatives] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [performanceMap, setPerformanceMap] = useState({});
  const [comparando, setComparando] = useState(false);
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const { filtered, options, filters, setStatus, setVeiculo, setCampanha, setPlataforma, setModeloCompra } = useMatrixFilters(creatives);
  const isMobile = useIsMobile();
  const { visualizacao } = useMatrixFiltersContext();

  useEffect(() => {
    const request = campanhaId ? getCreativesByCampanha(campanhaId) : getMatrixCreatives();
    request.then(setCreatives).catch(console.error);
    if (campanhaId) {
      getPerformancePorCampanha(campanhaId).then(setPerformanceMap).catch(() => setPerformanceMap({}));
    }
  }, [campanhaId]);

  function toggleSelect(id) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleCompararClick() {
    if (comparando) { setComparando(false); setSelecionados([]); return; }
    setComparando(true);
  }

  if (!creatives) return <Spinner />;

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

  const counts = groupByStatus(creatives);

  const compareButton = campanhaId && creatives.length >= 2 && (
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

  const statusGrid = (
    <div className="grid status-grid-4" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
      {Object.entries(counts).map(([status, count]) => (
        <div className="card" key={status}>
          <p className="card-title">{status}</p>
          <p className="kpi-value">{count}</p>
        </div>
      ))}
    </div>
  );

  const grid = (
    <>
      <CreativeCardGrid>
        {filtered.map((c) => (
          <CreativeGridCard
            key={c.id}
            creative={c}
            onOpenDetail={setViewing}
            canEdit={false}
            performance={performanceMap[c.id]}
            selectable={comparando}
            selected={selecionados.includes(c.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </CreativeCardGrid>
      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: 12 }}>
          {creatives.length === 0 ? "Nenhum criativo cadastrado ainda" : "Nenhum criativo encontrado para os filtros selecionados"}
        </div>
      )}
    </>
  );

  const modal = viewing && <CreativeFusedDetailModal creative={viewing} campanhaId={campanhaId} onClose={() => setViewing(null)} />;

  // Cliente ve o Kanban mas nao pode arrastar (readOnly) -- mudar status e
  // decisao da agencia/veiculo, nao do cliente. So mostra colunas de status
  // que tem pelo menos um criativo, pra nao poluir a tela com colunas vazias
  // (diferente do Kanban da agencia, que mostra todos os status possiveis).
  const statusComCriativos = [...new Set(creatives.map((c) => c.status))];

  const kanbanBoard = (
    <KanbanBoard
      items={filtered}
      statusOptions={statusComCriativos}
      statusColors={STATUS_COLORS}
      readOnly
      renderCard={(c) => (
        <CreativeGridCard
          creative={c}
          onOpenDetail={setViewing}
          canEdit={false}
          performance={performanceMap[c.id]}
          selectable={comparando}
          selected={selecionados.includes(c.id)}
          onToggleSelect={toggleSelect}
          esconderStatusBadge
          modoKanban
        />
      )}
    />
  );

  if (isMobile) {
    return (
      <div>
        <MatrixMobileHeader options={options} filters={filters} setStatus={setStatus} setVeiculo={setVeiculo} setCampanha={setCampanha} setPlataforma={setPlataforma} setModeloCompra={setModeloCompra} />
        <h2 style={{ margin: "16px 0" }}>Relatório de Criativos</h2>
        {campanhaId && <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>{compareButton}{abrirComparativoButton}</div>}
        {statusGrid}
        {visualizacao === "kanban" ? kanbanBoard : grid}
        {modal}
      </div>
    );
  }

  return (
    <div>
      {campanhaId && <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>{compareButton}{abrirComparativoButton}</div>}
      {statusGrid}
      {visualizacao === "kanban" ? kanbanBoard : grid}
      {modal}
    </div>
  );
}
