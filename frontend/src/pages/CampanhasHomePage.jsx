import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCampanhasHome, getCampanhasKanban, updateCampanhaStatus } from "../api/client.js";
import { STATUS_LABEL, STATUS_OPTIONS } from "../utils/campanhaStatus.js";
import CampaignComparisonSetupPage from "./CampaignComparisonSetupPage.jsx";
import Spinner from "../components/common/Spinner.jsx";
import KanbanBoard from "../components/common/KanbanBoard.jsx";
import { useCampanhasHomeFiltersContext } from "../context/CampanhasHomeFiltersContext.jsx";

const PAGE_SIZE = 20;

// Agrupa os 8 status de campanha em 3 categorias visuais (saudavel/atencao/neutro)
// -- a faixa lateral do card e a cor do chip usam essa categoria, nao o status cru.
const STATUS_CATEGORY = {
  ativo: "ok",
  aprovado: "ok",
  em_analise: "warn",
  pausado: "warn",
  agendado: "warn",
  programado: "warn",
  finalizado: "neutral",
  cancelado: "neutral",
};

const CATEGORY_COLORS = {
  ok: { fg: "var(--success)", soft: "rgba(22,163,74,0.12)" },
  warn: { fg: "#c77f1a", soft: "rgba(199,127,26,0.12)" },
  neutral: { fg: "var(--text-secondary)", soft: "var(--accent-soft)" },
};

function formatPeriodo(inicio, fim) {
  if (!inicio && !fim) return null;
  const fmt = (iso) => { const [, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}`; };
  if (inicio && fim) return `${fmt(inicio)} — ${fmt(fim)}`;
  return fmt(inicio || fim);
}

// Home pos-login: lista campanhas paginada/pesquisavel no backend (nao carrega tudo
// de uma vez -- o volume esperado e de milhares de campanhas). Cada card leva direto
// para a Matriz daquela campanha (cadastro + performance fundidos numa unica tela).
// campanhasParaAnalise (com plataformas por campanha, ja escopadas por permissao)
// alimenta o Comparativo de Campanhas, unico recurso que ainda precisa da lista
// completa em vez da paginada.
export default function CampanhasHomePage({ campanhasParaAnalise = [] }) {
  const { busca, status, comparativoAberto, setComparativoAberto, setTotal, setTemComparativo, visualizacao } = useCampanhasHomeFiltersContext();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [kanbanCampanhas, setKanbanCampanhas] = useState(null);
  const [kanbanError, setKanbanError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setTemComparativo(campanhasParaAnalise.length > 0);
  }, [campanhasParaAnalise.length, setTemComparativo]);

  useEffect(() => {
    if (visualizacao !== "grade") return;
    setData(null);
    const timer = setTimeout(() => {
      getCampanhasHome({ busca, status, page, pageSize: PAGE_SIZE })
        .then((result) => { setData(result); setTotal(result.total); })
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, status, page, visualizacao]);

  useEffect(() => { setPage(1); }, [busca, status]);

  function loadKanban() {
    setKanbanCampanhas(null);
    getCampanhasKanban().then(setKanbanCampanhas).catch(console.error);
  }

  useEffect(() => {
    if (visualizacao === "kanban") loadKanban();
  }, [visualizacao]);

  async function handleKanbanMove(campanha, novoStatus) {
    setKanbanError("");
    try {
      await updateCampanhaStatus(campanha.id, novoStatus);
      setKanbanCampanhas((prev) => prev.map((c) => (c.id === campanha.id ? { ...c, status: novoStatus } : c)));
    } catch (err) {
      setKanbanError(err.response?.data?.error || "Não foi possível mover esta campanha para esse status.");
      throw err;
    }
  }

  if (comparativoAberto) {
    return <CampaignComparisonSetupPage campanhas={campanhasParaAnalise} onVoltar={() => setComparativoAberto(false)} />;
  }

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  if (visualizacao === "kanban") {
    return (
      <div style={{ paddingTop: 20 }}>
        {!kanbanCampanhas ? (
          <Spinner />
        ) : (
          <KanbanBoard
            items={kanbanCampanhas}
            statusOptions={STATUS_OPTIONS}
            statusLabels={STATUS_LABEL}
            renderCard={(c) => <CampanhaCard campanha={c} navigate={navigate} />}
            onMoveCard={handleKanbanMove}
            error={kanbanError}
            onErrorClear={() => setKanbanError("")}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 20 }}>
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            {data.total === 0 && !busca && !status ? "Nenhuma campanha cadastrada ainda." : "Nenhuma campanha encontrada."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {data.items.map((c) => (
              <CampanhaCard key={c.id} campanha={c} navigate={navigate} />
            ))}
          </div>
          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}
              >
                Anterior
              </button>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", alignSelf: "center" }}>
                Página {page} de {totalPaginas}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                disabled={page >= totalPaginas}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: page >= totalPaginas ? "default" : "pointer", opacity: page >= totalPaginas ? 0.4 : 1 }}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CampanhaCard({ campanha, navigate }) {
  const categoria = STATUS_CATEGORY[campanha.status] || "neutral";
  const cor = CATEGORY_COLORS[categoria];
  const periodo = formatPeriodo(campanha.data_inicio, campanha.data_fim);

  return (
    <div
      onClick={() => navigate(`/matriz-de-conteudo/${campanha.id}`)}
      className="card"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "18px 18px 16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        cursor: "pointer",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: cor.fg }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
        <strong style={{ fontSize: 14.5, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{campanha.nome}</strong>
        {campanha.status && (
          <span
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
              textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap",
              color: cor.fg, background: cor.soft,
            }}
          >
            {STATUS_LABEL[campanha.status] || campanha.status}
          </span>
        )}
      </div>

      {periodo && (
        <p style={{ margin: "2px 0 14px", fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {periodo}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: periodo ? 0 : 10 }}>
        <div style={{ display: "flex", gap: 18 }}>
          <div>
            <span style={{ display: "block", fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {campanha.totalVeiculos ?? 0}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Veículos
            </span>
          </div>
          <div>
            <span style={{ display: "block", fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {campanha.totalCriativos ?? 0}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Criativos
            </span>
          </div>
        </div>

        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: cor.fg, flexShrink: 0 }}>
          Ver
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
