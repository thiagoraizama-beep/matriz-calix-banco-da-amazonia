import { useEffect, useRef, useState } from "react";
import StatusBadge from "./statusBadge.jsx";
import { labelUrgencia } from "../../utils/urgencia.js";
import KeywordCloud from "./KeywordCloud.jsx";
import MediaCarousel from "./MediaCarousel.jsx";
import { toDownloadZipUrl } from "../../api/client.js";

function formatPeriodo(inicio, fim) {
  if (!inicio && !fim) return null;
  const fmt = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
  if (inicio && fim) return `${fmt(inicio)} - ${fmt(fim)}`;
  return fmt(inicio || fim);
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function toDownloadUrl(url, filename) {
  const safe = filename.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return url.replace("/upload/", `/upload/fl_attachment:${safe}/`);
}

function buildFilename(creative) {
  const parts = [];
  if (creative.plataforma) parts.push(creative.plataforma);
  if (creative.ad_name) parts.push(creative.ad_name);
  return parts.length ? parts.join("_") : creative.nome;
}

const menuItemStyle = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
  border: "none", borderRadius: 7, background: "transparent", fontSize: 13,
  color: "var(--text-primary)", textAlign: "left", cursor: "pointer",
};

// Popover de troca de status, ancorado por position:fixed a partir do botao de
// lapis no proprio card -- mesmo padrao usado antes na tabela da Matriz.
function StatusPopover({ value, options, onChangeStatus, onClose, anchorRect }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const top = anchorRect ? anchorRect.bottom + 6 : 0;
  const left = anchorRect ? anchorRect.left : 0;

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", top, left, zIndex: 9999, background: "var(--card-bg)",
        border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
        padding: 6, minWidth: 190,
      }}
    >
      {options.map((s) => (
        <button
          key={s}
          onClick={(e) => { e.stopPropagation(); onChangeStatus(s); onClose(); }}
          style={{
            display: "block", width: "100%", padding: "8px 12px", border: "none", borderRadius: 7,
            background: s === value ? "var(--accent-soft)" : "transparent",
            color: s === value ? "var(--accent)" : "var(--text-primary)",
            fontWeight: s === value ? 700 : 400, fontSize: 13, textAlign: "left", cursor: "pointer",
          }}
        >
          <StatusBadge status={s} />
        </button>
      ))}
    </div>
  );
}

// Menu de acoes (baixar/ver detalhes/editar/duplicar/excluir) acionado pelo botao
// "..." -- substitui o rodape de icones sempre expostos, mantendo o card focado na
// peca criativa. Mesmo padrao de popover fixo do StatusPopover.
function ActionsMenu({ creative, onOpenDetail, onEdit, onDuplicate, onDelete, canEdit, onClose, anchorRect }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const top = anchorRect ? anchorRect.bottom + 6 : 0;
  const right = anchorRect ? window.innerWidth - anchorRect.right : 0;

  function run(fn) {
    fn(creative);
    onClose();
  }

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed", top, right, zIndex: 9999, background: "var(--card-bg)",
        border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
        padding: 6, minWidth: 180,
      }}
    >
      <button onClick={() => run(onOpenDetail)} style={menuItemStyle}><EyeIcon /> Ver detalhes</button>
      {Number(creative.arquivos_extras) > 0 ? (
        // Criativo com multiplos arquivos -- baixa tudo junto num .zip (link
        // direto no cloudinary_url so traria o arquivo principal).
        <a
          href={toDownloadZipUrl(creative.id)}
          onClick={onClose}
          style={{ ...menuItemStyle, textDecoration: "none" }}
        >
          <DownloadIcon /> Baixar tudo (.zip)
        </a>
      ) : creative.cloudinary_url && (
        <a
          href={toDownloadUrl(creative.cloudinary_url, buildFilename(creative))}
          download={buildFilename(creative)}
          onClick={onClose}
          style={{ ...menuItemStyle, textDecoration: "none" }}
        >
          <DownloadIcon /> Baixar
        </a>
      )}
      {canEdit && (
        <>
          <button onClick={() => run(onEdit)} style={menuItemStyle}><PencilIcon /> Editar</button>
          <button onClick={() => run(onDuplicate)} style={menuItemStyle}><CopyIcon /> Duplicar</button>
          <button onClick={() => run(onDelete)} style={{ ...menuItemStyle, color: "var(--danger)" }}><TrashIcon /> Excluir</button>
        </>
      )}
    </div>
  );
}

function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("pt-BR");
}

// Barra de progresso Orcamento projetado x Investido -- so aparece em criativos
// marcados como "Performance" (checkbox no cadastro) com orcamento definido. Passa
// de 100% quando o investido ultrapassa o projetado, sinalizado em vermelho.
export function OrcamentoBar({ orcamento, investido }) {
  const pct = orcamento > 0 ? Math.min(100, (investido / orcamento) * 100) : 0;
  const estourou = investido > orcamento;

  // A barra nasce em 0% e so anima ate o valor real no proximo frame -- uma
  // transicao CSS nao dispara quando o elemento ja monta com o width final,
  // entao sem isso o preenchimento aparecia "estatico" (saltava direto pro
  // valor, sem crescer visivelmente).
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setLargura(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
        <span>Orçamento</span>
        <span style={{ color: estourou ? "var(--danger)" : "var(--text-secondary)", fontWeight: 600 }}>
          R$ {investido.toLocaleString("pt-BR")} / R$ {orcamento.toLocaleString("pt-BR")}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${largura}%`,
            borderRadius: 999,
            background: estourou ? "var(--danger)" : "var(--success)",
            transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

// Faixa compacta de metricas (Investimento/Impressoes/Cliques/CTR), carregada em
// lote pela view (ver AgencyMatrixView.jsx etc.). Criativos com acesso_analise_criativo
// mas ainda sem Ad Name preenchido (campo opcional, preenchido pelo BI depois) ou
// sem match na planilha nao tem entrada no mapa de performance -- mostram a faixa
// zerada mesmo assim (METRICAS_ZERADAS), sinalizando "aguardando dados" em vez de
// sumir a secao inteira. So quando o vinculo nao tem a permissao e que a faixa some.
const METRICAS_ZERADAS = { investimento: 0, ctr: 0, impressoes: 0, cliques: 0 };

function MetricsRow({ performance }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          R$ {performance.investimento.toLocaleString("pt-BR")}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Investimento</span>
      </div>
      <div>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{performance.ctr}%</span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>CTR</span>
      </div>
      <div>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCompact(performance.impressoes)}</span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Impressões</span>
      </div>
      <div>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCompact(performance.cliques)}</span>
        <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Cliques</span>
      </div>
    </div>
  );
}

// Card grande e visual de um criativo -- mídia em destaque (aspect-ratio 4:3),
// nome + status; clique no corpo abre o detalhe fundido (cadastro + performance
// detalhada, ver CreativeFusedDetailModal). Metricas-resumo (quando disponiveis)
// aparecem inline; acoes de CRUD/download ficam atras do menu "...", sempre
// visivel mas discreto, em vez de botoes expostos poluindo o card.
export default function CreativeGridCard({
  creative, onOpenDetail, onEdit, onDuplicate, onDelete, canEdit,
  statusOptions, onStatusChange, updatingStatus, performance,
  selectable, selected, onToggleSelect,
  urgente, campanhaNome, esconderStatusBadge, modoKanban,
}) {
  const [statusAnchor, setStatusAnchor] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const statusBtnRef = useRef(null);
  const menuBtnRef = useRef(null);
  const urgenciaLabel = urgente ? labelUrgencia(creative.periodo_inicio) : null;

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

  function handleCardClick() {
    if (selectable) onToggleSelect(creative.id);
    else onOpenDetail(creative);
  }

  return (
    <div
      className={`card${!selected && creative.status === "Aguardando implementação" ? " card-glow-aguardando" : ""}`}
      style={{
        padding: 0, overflow: "hidden", display: "flex", flexDirection: "column",
        border: selected
          ? "2px solid var(--accent)"
          : creative.status === "Aguardando implementação"
          ? "2px solid transparent"
          : urgenciaLabel
          ? "2px solid #c77f1a"
          : "2px solid transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, flex: 1 }}>
          {!esconderStatusBadge && (
            <span style={{ minWidth: 0 }}>
              <StatusBadge status={creative.status} truncate />
            </span>
          )}
          {urgenciaLabel && (
            <span
              style={{
                fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, flexShrink: 0,
                textTransform: "uppercase", letterSpacing: "0.02em", color: "#c77f1a", background: "rgba(199,127,26,0.12)",
              }}
            >
              {urgenciaLabel}
            </span>
          )}
          {!selectable && statusOptions && (
            <button
              ref={statusBtnRef}
              onClick={toggleStatus}
              disabled={updatingStatus}
              title="Alterar status"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0,
                borderRadius: 6, border: "none", background: "transparent",
                cursor: updatingStatus ? "default" : "pointer", color: "var(--text-secondary)",
                opacity: updatingStatus ? 0.5 : 1,
              }}
            >
              <PencilIcon />
            </button>
          )}
        </div>
        {!selectable && (
          <button
            ref={menuBtnRef}
            onClick={toggleMenu}
            title="Mais ações"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer",
            }}
          >
            <DotsIcon />
          </button>
        )}
      </div>

      <div
        onClick={handleCardClick}
        style={{
          cursor: "pointer", position: "relative", background: "var(--bg)", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center", height: 220,
        }}
      >
        {creative.formato?.includes("Search") ? (
          <KeywordCloud palavrasChave={creative.search_campos?.palavrasChave} />
        ) : (
          <MediaCarousel creative={creative} mostrarIndicadores={false} />
        )}
        {selectable && (
          <div
            style={{
              position: "absolute", bottom: 10, left: 10, width: 22, height: 22, borderRadius: 6,
              border: `2px solid ${selected ? "var(--accent)" : "#fff"}`, background: selected ? "var(--accent)" : "rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {selected && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
        {!modoKanban && formatPeriodo(creative.periodo_inicio, creative.periodo_fim) && (
          <span
            style={{
              position: "absolute", bottom: 8, right: 8, display: "flex", alignItems: "center", gap: 3,
              fontSize: 9.5, fontWeight: 600, color: "#fff", background: "rgba(20,33,61,0.55)",
              padding: "3px 7px", borderRadius: 999, backdropFilter: "blur(2px)",
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M8 2v4M16 2v4M3 10h18" />
            </svg>
            {formatPeriodo(creative.periodo_inicio, creative.periodo_fim)}
          </span>
        )}
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
            onOpenDetail={onOpenDetail}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onClose={() => setMenuAnchor(null)}
          />
        )}
      </div>

      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div>
          <strong style={{ fontSize: 13.5, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {creative.nome}
          </strong>
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
            {creative.plataforma || creative.veiculo}
          </span>
          {campanhaNome && (
            <span style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {campanhaNome}
            </span>
          )}
        </div>

        {!modoKanban && creative.acesso_analise_criativo === true && (
          <MetricsRow performance={performance || METRICAS_ZERADAS} />
        )}
        {!modoKanban && creative.eh_performance && creative.orcamento_projetado > 0 && creative.acesso_analise_criativo === true && (
          <OrcamentoBar orcamento={Number(creative.orcamento_projetado)} investido={(performance || METRICAS_ZERADAS).investimento} />
        )}
      </div>
    </div>
  );
}
