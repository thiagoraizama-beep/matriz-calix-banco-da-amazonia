import { useEffect, useState } from "react";
import { getMatrixCreatives, getCreativesByCampanha, deleteMatrixCreative, bulkDeleteCreatives, updateMatrixCreativeStatus, syncCampanhaStatus, getPerformancePorCampanha } from "../../../api/client.js";
import CreativeFormModal from "./CreativeFormModal.jsx";
import BulkEditModal from "./BulkEditModal.jsx";
import CreativeCardGrid from "../CreativeCardGrid.jsx";
import CreativeGridCard from "../CreativeGridCard.jsx";
import CreativeFusedDetailModal from "../CreativeFusedDetailModal.jsx";
import CreativeComparisonPage from "../CreativeComparisonPage.jsx";
import { STATUS_OPTIONS_AGENCIA } from "../statusBadge.jsx";
import MatrixMobileHeader from "../MatrixMobileHeader.jsx";
import { useMatrixFilters } from "../useMatrixFilters.js";
import { groupByStatus } from "../statusCounts.js";
import Spinner from "../../common/Spinner.jsx";
import useIsMobile from "../../../hooks/useIsMobile.js";
import ConfirmDialog from "../../common/ConfirmDialog.jsx";
import TrashIcon from "../../common/TrashIcon.jsx";
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

function PlusIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3v18M15 3v18M4 8h5M4 16h5M15 8h5M15 16h5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function AgencyMatrixView({ campanhaId } = {}) {
  const [creatives, setCreatives] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [performanceMap, setPerformanceMap] = useState({});
  const [comparando, setComparando] = useState(false);
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [editandoEmMassa, setEditandoEmMassa] = useState(false);
  const [bulkModalAberto, setBulkModalAberto] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [excluindoEmMassa, setExcluindoEmMassa] = useState(false);
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

  async function handleSync() {
    if (!campanhaId) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const resultado = await syncCampanhaStatus(campanhaId);
      setSyncResult(resultado);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  }

  async function handleConfirmDelete() {
    await deleteMatrixCreative(deleting.id);
    setDeleting(null);
    load();
  }

  async function handleConfirmBulkDelete() {
    setExcluindoEmMassa(true);
    try {
      await bulkDeleteCreatives(selecionados);
      setBulkDeleting(false);
      setSelecionados([]);
      setEditandoEmMassa(false);
      load();
    } finally {
      setExcluindoEmMassa(false);
    }
  }

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      await updateMatrixCreativeStatus(id, status);
      setCreatives((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    } finally {
      setUpdatingId(null);
    }
  }

  function openEdit(creative) { setEditing(creative); setModalOpen(true); }
  function openCreate() { setEditing(null); setModalOpen(true); }
  function openDuplicate(creative) { setEditing({ ...creative, _duplicate: true, id: null }); setModalOpen(true); }

  function toggleSelect(id) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleCompararClick() {
    if (comparando) { setComparando(false); setSelecionados([]); return; }
    setComparando(true);
  }

  function handleEditarEmMassaClick() {
    if (editandoEmMassa) { setEditandoEmMassa(false); setSelecionados([]); return; }
    setEditandoEmMassa(true);
  }

  function handleBulkSaved() {
    setBulkModalAberto(false);
    setEditandoEmMassa(false);
    setSelecionados([]);
    load();
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

  // Enquanto um modo de selecao em lote (comparar ou editar em massa) esta ativo,
  // os demais botoes da toolbar somem -- so o que e relevante aquele modo (Cancelar
  // selecao + a acao do modo) fica visivel, evitando poluir a barra com acoes que
  // nao fazem sentido misturar com uma selecao em andamento.
  const modoSelecaoAtivo = comparando || editandoEmMassa;

  const newButton = !modoSelecaoAtivo && (
    <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
      <PlusIcon size={14} /> Novo criativo
    </button>
  );

  const COR_SYNC = "#0f6e4f";
  const COR_COMPARAR = "var(--accent)";
  const COR_EDITAR_MASSA = "#1e9c6b";

  const syncButton = campanhaId && !modoSelecaoAtivo && (
    <button
      onClick={handleSync}
      disabled={syncing}
      title="Verifica a planilha de Realizado e atualiza status automaticamente (Programado -> Ativo, etc)"
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: syncing ? "default" : "pointer",
        border: `1px solid ${COR_SYNC}`, background: "transparent", color: COR_SYNC, opacity: syncing ? 0.6 : 1,
      }}
    >
      <SyncIcon /> {syncing ? "Sincronizando..." : "Sincronizar status"}
    </button>
  );

  const compareButton = campanhaId && creatives?.length >= 2 && !editandoEmMassa && (
    <button
      onClick={handleCompararClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${COR_COMPARAR}`,
        background: comparando ? COR_COMPARAR : "transparent",
        color: comparando ? "#fff" : COR_COMPARAR,
      }}
    >
      {comparando ? <XIcon /> : <CompareIcon />} {comparando ? `Cancelar seleção (${selecionados.length})` : "Selecionar para comparar"}
    </button>
  );

  const abrirComparativoButton = comparando && selecionados.length >= 2 && (
    <button
      onClick={() => setComparativoAberto(true)}
      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "none", background: COR_COMPARAR, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      <CompareIcon /> Comparar agora ({selecionados.length})
    </button>
  );

  const editarEmMassaButton = campanhaId && creatives?.length >= 2 && !comparando && (
    <button
      onClick={handleEditarEmMassaClick}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${COR_EDITAR_MASSA}`,
        background: editandoEmMassa ? COR_EDITAR_MASSA : "transparent",
        color: editandoEmMassa ? "#fff" : COR_EDITAR_MASSA,
      }}
    >
      {editandoEmMassa ? <XIcon /> : <EditIcon />} {editandoEmMassa ? `Cancelar seleção (${selecionados.length})` : "Editar em massa"}
    </button>
  );

  const editarEmMassaBarra = editandoEmMassa && selecionados.length > 0 && (
    <>
      <button
        onClick={() => setBulkModalAberto(true)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "none", background: COR_EDITAR_MASSA, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        <EditIcon /> Editar {selecionados.length} criativo(s)
      </button>
      <button
        onClick={() => setBulkDeleting(true)}
        title={`Excluir ${selecionados.length} criativo(s)`}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", flexShrink: 0 }}
      >
        <TrashIcon />
      </button>
    </>
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
            onEdit={openEdit}
            onDuplicate={openDuplicate}
            onDelete={setDeleting}
            canEdit
            statusOptions={STATUS_OPTIONS_AGENCIA}
            onStatusChange={handleStatusChange}
            updatingStatus={updatingId === c.id}
            performance={performanceMap[c.id]}
            selectable={comparando || editandoEmMassa}
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

  const syncFeedback = syncResult && (
    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
      {syncResult.criativosAlterados} criativo(s) atualizado(s) de {syncResult.criativosAvaliados} avaliado(s).
    </p>
  );

  const modals = (
    <>
      {modalOpen && <CreativeFormModal creative={editing} onClose={() => setModalOpen(false)} onSaved={load} />}
      {bulkModalAberto && <BulkEditModal ids={selecionados} onClose={() => setBulkModalAberto(false)} onSaved={handleBulkSaved} />}
      {viewing && <CreativeFusedDetailModal creative={viewing} campanhaId={campanhaId} onClose={() => setViewing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Excluir criativo"
          message={`Tem certeza que deseja excluir "${deleting.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
      {bulkDeleting && (
        <ConfirmDialog
          title="Excluir criativos"
          message={`Tem certeza que deseja excluir ${selecionados.length} criativo(s)? Esta ação não pode ser desfeita.`}
          confirmLabel={excluindoEmMassa ? "Excluindo..." : "Excluir"}
          confirming={excluindoEmMassa}
          onConfirm={handleConfirmBulkDelete}
          onCancel={() => setBulkDeleting(false)}
        />
      )}
    </>
  );

  if (isMobile) {
    return (
      <div>
        <MatrixMobileHeader
          options={options} filters={filters}
          setStatus={setStatus} setVeiculo={setVeiculo} setCampanha={setCampanha} setPlataforma={setPlataforma} setModeloCompra={setModeloCompra}
          extraAction={
            <button onClick={openCreate} aria-label="Novo criativo" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}>
              <PlusIcon />
            </button>
          }
        />
        <h2 style={{ margin: "16px 0" }}>Matriz de Conteúdo</h2>
        {campanhaId && (
          <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {syncButton}{compareButton}{abrirComparativoButton}{editarEmMassaButton}{editarEmMassaBarra}
          </div>
        )}
        {syncFeedback}
        {urgenciaBanner}
        {statusGrid}
        {grid}
        {modals}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {syncButton}
        {compareButton}
        {abrirComparativoButton}
        {editarEmMassaButton}
        {editarEmMassaBarra}
        {newButton}
      </div>
      {syncResult && <div style={{ textAlign: "right" }}>{syncFeedback}</div>}
      {urgenciaBanner}
      {statusGrid}
      {grid}
      {modals}
    </div>
  );
}
