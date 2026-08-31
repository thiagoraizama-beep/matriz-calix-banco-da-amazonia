import { useRef, useState } from "react";
import StatusBadge from "../statusBadge.jsx";
import MediaCarousel from "../MediaCarousel.jsx";
import KeywordCloud from "../KeywordCloud.jsx";
import { OrcamentoBar, StatusPopover, ActionsMenu } from "../CreativeGridCard.jsx";

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("pt-BR");
}

const METRICAS_ZERADAS = { investimento: 0, ctr: 0, impressoes: 0, cliques: 0 };

// Card dedicado do modo Foco -- media grande em destaque (nao a faixa de
// header do card comum), corpo com nome/plataforma/status juntos numa linha,
// 4 metricas completas, orcamento, e botoes "Editar"/"Mais" explicitos no
// rodape (em vez do menu discreto de "..." no topo, que faz sentido numa
// grade densa mas nao aqui, onde ha espaco de sobra e so 1 criativo por vez).
export default function CreativeFocusCard({
  creative, onOpenDetail, onEdit, onDuplicate, onDelete, canEdit,
  statusOptions, onStatusChange, updatingStatus, performance,
}) {
  const [statusAnchor, setStatusAnchor] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const statusBtnRef = useRef(null);
  const menuBtnRef = useRef(null);
  const metrics = performance || METRICAS_ZERADAS;

  function toggleStatus(e) {
    e.stopPropagation();
    if (statusAnchor) { setStatusAnchor(null); return; }
    if (statusBtnRef.current) setStatusAnchor(statusBtnRef.current.getBoundingClientRect());
  }

  function toggleMenu(e) {
    e.stopPropagation();
    if (menuAnchor) { setMenuAnchor(null); return; }
    if (menuBtnRef.current) setMenuAnchor(menuBtnRef.current.getBoundingClientRect());
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        onClick={() => onOpenDetail?.(creative)}
        style={{ position: "relative", height: 340, background: "var(--bg)", cursor: onOpenDetail ? "pointer" : "default" }}
      >
        {creative.formato?.includes("Search") ? (
          <KeywordCloud palavrasChave={creative.search_campos?.palavrasChave} />
        ) : (
          <MediaCarousel creative={creative} />
        )}
      </div>

      <div style={{ padding: "14px 16px 16px" }}>
        <strong
          onClick={() => onOpenDetail?.(creative)}
          style={{ fontSize: 15, fontWeight: 700, display: "block", cursor: onOpenDetail ? "pointer" : "default" }}
        >
          {creative.nome}
        </strong>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{creative.plataforma || creative.veiculo}</span>
          <span style={{ color: "var(--border)" }}>·</span>
          <button
            ref={statusBtnRef}
            onClick={toggleStatus}
            disabled={updatingStatus}
            title="Alterar status"
            style={{ border: "none", background: "transparent", padding: 0, cursor: updatingStatus ? "default" : "pointer", opacity: updatingStatus ? 0.5 : 1 }}
          >
            <StatusBadge status={creative.status} />
          </button>
        </div>

        {creative.acesso_analise_criativo === true && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: 12 }}>
            <div>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>R$ {metrics.investimento.toLocaleString("pt-BR")}</span>
              <span style={{ fontSize: 9.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Investimento</span>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{metrics.ctr}%</span>
              <span style={{ fontSize: 9.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>CTR</span>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCompact(metrics.impressoes)}</span>
              <span style={{ fontSize: 9.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Impressões</span>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCompact(metrics.cliques)}</span>
              <span style={{ fontSize: 9.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Cliques</span>
            </div>
          </div>
        )}

        {creative.eh_performance && creative.orcamento_projetado > 0 && creative.acesso_analise_criativo === true && (
          <OrcamentoBar orcamento={Number(creative.orcamento_projetado)} investido={metrics.investimento} />
        )}

        {canEdit && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={() => onEdit(creative)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <EditIcon /> Editar
            </button>
            <button
              ref={menuBtnRef}
              onClick={toggleMenu}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              <DotsIcon /> Mais
            </button>
          </div>
        )}
      </div>

      {statusAnchor && (
        <StatusPopover
          value={creative.status}
          options={statusOptions}
          anchorRect={statusAnchor}
          onChangeStatus={(status) => { onStatusChange(creative.id, status); setStatusAnchor(null); }}
          onClose={() => setStatusAnchor(null)}
        />
      )}
      {menuAnchor && (
        <ActionsMenu
          creative={creative}
          anchorRect={menuAnchor}
          canEdit={canEdit}
          onOpenDetail={onOpenDetail || (() => {})}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </div>
  );
}
