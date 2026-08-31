import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMatrixCreatives, getCreativesByCampanha, deleteMatrixCreative, bulkDeleteCreatives, updateMatrixCreativeStatus, syncCampanhaStatus, getPerformancePorCampanha, getBulkEditOperations } from "../../../api/client.js";
import GerarPlanilhaModal from "./GerarPlanilhaModal.jsx";
import CreativeFormModal from "./CreativeFormModal.jsx";
import BulkEditModal from "./BulkEditModal.jsx";
import BulkEditHistoryPanel from "./BulkEditHistoryPanel.jsx";
import ActionsRail from "../../common/ActionsRail.jsx";
import CreativeCardGrid from "../CreativeCardGrid.jsx";
import CreativeGridCard from "../CreativeGridCard.jsx";
import CreativeFusedDetailModal from "../CreativeFusedDetailModal.jsx";
import CreativeComparisonPage from "../CreativeComparisonPage.jsx";
import { STATUS_OPTIONS_AGENCIA, STATUS_OPTIONS_VEICULO, STATUS_COLORS } from "../statusBadge.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import MatrixMobileHeader from "../MatrixMobileHeader.jsx";
import { useMatrixFilters } from "../useMatrixFilters.js";
import { groupByStatus } from "../statusCounts.js";
import Spinner from "../../common/Spinner.jsx";
import useIsMobile from "../../../hooks/useIsMobile.js";
import ConfirmDialog from "../../common/ConfirmDialog.jsx";
import KanbanBoard from "../../common/KanbanBoard.jsx";
import { useMatrixFiltersContext } from "../../../context/MatrixFiltersContext.jsx";
import TrashIcon from "../../common/TrashIcon.jsx";
import { isUrgente } from "../../../utils/urgencia.js";
import MatrixSidebarFilters from "./MatrixSidebarFilters.jsx";
import CreativeFocusCard from "./CreativeFocusCard.jsx";

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

function HistoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4l3 3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function FocusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="12" height="18" rx="2" />
      <line x1="18" y1="8" x2="21" y2="8" /><line x1="18" y1="12" x2="21" y2="12" /><line x1="18" y1="16" x2="21" y2="16" />
    </svg>
  );
}

export default function AgencyMatrixView({ campanhaId } = {}) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creatives, setCreatives] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);
  // Aba com que o modal de detalhe abre -- "comentarios" quando veio de um
  // clique numa notificacao de mencao (ver abaixo), "implementacao" no resto.
  const [viewingAbaInicial, setViewingAbaInicial] = useState("implementacao");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [performanceMap, setPerformanceMap] = useState({});
  const [comparando, setComparando] = useState(false);
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  // Guarda os IDs dos criativos urgentes que estavam no banner quando o
  // usuario o fechou -- some ate que a lista de urgentes mude (um criativo
  // novo entrar na janela de "hoje ou amanha"), nao so por um dia fixo, ja
  // que essas notificacoes tambem aparecem no sino (ver NotificationBell.jsx).
  const [bannerUrgenciaFechadoIds, setBannerUrgenciaFechadoIds] = useState(null);
  const [editandoEmMassa, setEditandoEmMassa] = useState(false);
  const [bulkModalAberto, setBulkModalAberto] = useState(false);
  const [bulkHistoryAberto, setBulkHistoryAberto] = useState(false);
  const [exportExcelAberto, setExportExcelAberto] = useState(false);
  const [bulkOperationsCount, setBulkOperationsCount] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [excluindoEmMassa, setExcluindoEmMassa] = useState(false);
  // "grade" (padrao) ou "kanban" (colunas por status, arrastar muda o status)
  // -- estado vem do MatrixFiltersContext (nao mais local) para que a TopNav
  // renderize o toggle dentro do menu do usuario, igual ao Tema.
  const { visualizacao, setVisualizacao, overlayAberto } = useMatrixFiltersContext();
  const [kanbanError, setKanbanError] = useState("");
  // Modo dentro da visualizacao "grade" (nao confundir com visualizacao
  // grade/kanban acima): "grade" mostra todos os cards lado a lado pra
  // comparar; "foco" mostra 1 criativo grande + lista compacta de navegacao
  // ao lado, pra examinar em detalhe sem abrir o modal. So existe no modo
  // Grade desktop -- o Kanban continua com seu proprio layout, sem foco.
  const [modoCards, setModoCards] = useState("grade");
  const [focoCreativeId, setFocoCreativeId] = useState(null);
  const { filtered, options, filters, setStatus, setVeiculo, setCampanha, setPlataforma, setModeloCompra } = useMatrixFilters(creatives);
  const isMobile = useIsMobile();
  const statusCounts = creatives ? groupByStatus(creatives) : {};
  // Verba total da campanha: soma orcamento_projetado (Planejado) dos
  // criativos marcados como "Performance" (eh_performance) -- mesmo
  // conceito usado no card da lista de campanhas (Home). Realizado soma o
  // investimento real (performanceMap, ja carregado pra alimentar a
  // OrcamentoBar de cada criativo) so dos MESMOS criativos "Performance" --
  // sem isso o Realizado incluiria investimento de criativos sem orcamento
  // projetado, tornando a comparacao sem sentido. So faz sentido dentro de
  // uma campanha especifica (campanhaId) -- fora dela misturaria varias
  // campanhas numa soma so. Parte de "filtered" (ja filtrado por
  // plataforma/status/veiculo/etc), nao da lista crua -- a verba reflete
  // exatamente o que esta sendo mostrado na tela, nao a campanha inteira.
  const criativosPerformance = campanhaId ? (filtered || []).filter((c) => c.eh_performance && c.orcamento_projetado) : [];
  const verbaPlanejada = criativosPerformance.reduce((soma, c) => soma + Number(c.orcamento_projetado), 0);
  const verbaRealizada = criativosPerformance.reduce((soma, c) => soma + (performanceMap[c.id]?.investimento || 0), 0);

  function load() {
    setCreatives(null);
    const request = campanhaId ? getCreativesByCampanha(campanhaId) : getMatrixCreatives();
    request.then(setCreatives).catch(console.error);
    if (campanhaId) {
      getPerformancePorCampanha(campanhaId).then(setPerformanceMap).catch(() => setPerformanceMap({}));
    }
  }

  function loadBulkOperationsCount() {
    getBulkEditOperations().then((ops) => setBulkOperationsCount(ops.length)).catch(() => {});
  }

  useEffect(() => { load(); }, [campanhaId]);
  useEffect(() => { loadBulkOperationsCount(); }, [campanhaId]);

  // Abertura automatica do modal de detalhe via ?criativo=<id> na URL -- usado
  // ao clicar numa notificacao de mencao no sino (NotificationBell.jsx), que
  // navega pra ca antes de abrir. So dispara quando a lista de criativos ja
  // carregou (senao o id ainda nao existe pra buscar); remove o parametro da
  // URL depois de abrir, pra nao reabrir o modal ao navegar de volta.
  useEffect(() => {
    const criativoIdParam = searchParams.get("criativo");
    if (!criativoIdParam || !creatives) return;
    const alvo = creatives.find((c) => String(c.id) === criativoIdParam);
    if (alvo) {
      setViewingAbaInicial("comentarios");
      setViewing(alvo);
    }
    setSearchParams((prev) => {
      const novo = new URLSearchParams(prev);
      novo.delete("criativo");
      return novo;
    }, { replace: true });
  }, [creatives, searchParams]);

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
      loadBulkOperationsCount();
    } finally {
      setUpdatingId(null);
    }
  }

  // Usado pelo KanbanBoard -- mesma chamada de handleStatusChange, mas
  // propaga o erro (403 de permissao, por ex.) em vez de engolir, para o
  // board poder reverter o card visualmente e mostrar o aviso certo.
  async function handleKanbanMove(creative, novoStatus) {
    setKanbanError("");
    try {
      await updateMatrixCreativeStatus(creative.id, novoStatus);
      setCreatives((prev) => prev.map((c) => (c.id === creative.id ? { ...c, status: novoStatus } : c)));
    } catch (err) {
      setKanbanError(err.response?.data?.error || "Não foi possível mover este criativo para esse status.");
      throw err;
    }
  }

  function openEdit(creative) { setEditing(creative); setModalOpen(true); }
  function openCreate() { setEditing(null); setModalOpen(true); }
  function openDuplicate(creative) { setEditing({ ...creative, _duplicate: true, id: null }); setModalOpen(true); }

  // Desmarcar o ultimo item selecionado sai automaticamente do modo de
  // selecao (comparar/editar em massa) -- antes o usuario ficava "preso" na
  // barra de selecao mesmo com 0 itens marcados, precisando clicar em
  // "Cancelar seleção" a parte pra sair.
  function toggleSelect(id) {
    setSelecionados((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      if (next.length === 0) {
        setComparando(false);
        setEditandoEmMassa(false);
      }
      return next;
    });
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
    loadBulkOperationsCount();
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

  // Lista de acoes pro ActionsRail (barra lateral flutuante colapsavel do
  // desktop) -- mesmas condicoes/handlers dos botoes horizontais acima, so
  // reorganizados no formato que o rail espera. As acoes contextuais de um
  // modo de selecao ja ativo (cancelar, aplicar, excluir) vivem na
  // selecaoBarra, acima dos cards -- mas o resto do rail (Novo criativo,
  // Sincronizar, Ultimas edicoes) continua sempre visivel, so os botoes que
  // iniciam um modo ja ativo somem (nao faz sentido "Comparar" de novo
  // enquanto ja comparando).
  const railItems = [
    { key: "new", icon: <PlusIcon size={16} />, label: "Novo criativo", onClick: openCreate, tone: "solid" },
    campanhaId && creatives?.length >= 2 && !comparando && !editandoEmMassa && {
      key: "bulk-edit",
      icon: <EditIcon />,
      label: "Editar em massa",
      onClick: handleEditarEmMassaClick,
      tone: "accent",
    },
    campanhaId && creatives?.length >= 2 && !editandoEmMassa && !comparando && {
      key: "compare",
      icon: <CompareIcon />,
      label: "Comparar",
      onClick: handleCompararClick,
      tone: "accent",
    },
    campanhaId && {
      key: "sync",
      icon: <SyncIcon />,
      label: syncing ? "Sincronizando..." : "Sincronizar status",
      onClick: handleSync,
      tone: "accent",
      disabled: syncing,
    },
    campanhaId && creatives?.length >= 1 && {
      key: "bulk-history",
      icon: <HistoryIcon />,
      label: "Últimas edições",
      onClick: () => setBulkHistoryAberto(true),
      tone: "default",
      badge: bulkOperationsCount,
    },
    campanhaId && creatives?.length >= 1 && !modoSelecaoAtivo && {
      key: "gerar-planilha",
      icon: <SheetIcon />,
      label: "Gerar planilha",
      onClick: () => setExportExcelAberto(true),
      tone: "default",
    },
  ];

  // Botao discreto pra rever/desfazer as ultimas edicoes (ate 2h) -- cobre
  // tanto edicao em massa quanto individual (inclusive troca de status),
  // entao aparece sempre que houver pelo menos 1 criativo na tela, nao so
  // quando o "Editar em massa" tambem estiver disponivel. Usado no mobile
  // (o ActionsRail flutuante e so pro desktop).
  const bulkHistoryButton = campanhaId && creatives?.length >= 1 && (
    <button
      onClick={() => setBulkHistoryAberto(true)}
      title="Últimas edições em massa"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999,
        border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", flexShrink: 0,
      }}
    >
      <HistoryIcon />
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

  // Abas de plataforma (Todos / Meta Ads / Google Ads / ...) acima da grade --
  // usa o mesmo filtro de plataforma que ja existia (setPlataforma), so muda a
  // apresentacao: em vez de um multi-select generico, uma aba unica selecionavel
  // por vez, cada uma com o investimento total daquela plataforma (somado via
  // performanceMap, ja carregado pra alimentar a OrcamentoBar de cada criativo).
  // Baseado em "creatives" (nao "filtered"), pra a lista de abas nao sumir
  // quando outro filtro (status/veiculo/busca) reduz a lista visivel.
  const plataformaAtiva = filters.plataforma[0] || null;
  const abasPlataforma = (creatives || []).reduce((mapa, c) => {
    if (!c.plataforma) return mapa;
    mapa.set(c.plataforma, (mapa.get(c.plataforma) || 0) + 1);
    return mapa;
  }, new Map());
  function selecionarAbaPlataforma(nome) {
    setPlataforma(nome ? [nome] : []);
  }
  // Investimento (Realizado) somado por plataforma, a partir do MESMO
  // universo ja filtrado por status/veiculo/busca (filtered) -- reflete o
  // que esta na tela, nao a campanha toda, mesmo raciocinio da Verba total.
  const investimentoPorPlataforma = filtered.reduce((mapa, c) => {
    if (!c.plataforma) return mapa;
    const investimento = performanceMap[c.id]?.investimento || 0;
    mapa.set(c.plataforma, (mapa.get(c.plataforma) || 0) + investimento);
    return mapa;
  }, new Map());
  const investimentoTotalFiltrado = [...investimentoPorPlataforma.values()].reduce((a, b) => a + b, 0);
  const formatBRL = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Agrupa a grade por plataforma (Meta Ads, Google Ads, ...), na ordem em
  // que cada uma aparece pela primeira vez em filteredOrdenado -- evita
  // misturar plataformas diferentes visualmente quando a sidebar esta em
  // "Todas". Com uma plataforma especifica filtrada, ha sempre 1 grupo so.
  const gruposPlataforma = Object.entries(
    filteredOrdenado.reduce((mapa, c) => {
      const chave = c.plataforma || "";
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(c);
      return mapa;
    }, {})
  );

  const abasPlataformaBarra = campanhaId && abasPlataforma.size > 0 && (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => selecionarAbaPlataforma(null)}
        style={{
          padding: "8px 4px 12px", marginRight: 22, border: "none", background: "transparent", cursor: "pointer",
          color: !plataformaAtiva ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: !plataformaAtiva ? 700 : 600, fontSize: 13.5,
          borderBottom: !plataformaAtiva ? "2px solid var(--accent)" : "2px solid transparent",
        }}
      >
        Todos <span style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 12 }}>· {creatives?.length || 0}</span>
      </button>
      {[...abasPlataforma.entries()].map(([nome, count]) => (
        <button
          key={nome}
          type="button"
          onClick={() => selecionarAbaPlataforma(nome)}
          style={{
            padding: "8px 4px 12px", marginRight: 22, border: "none", background: "transparent", cursor: "pointer",
            color: plataformaAtiva === nome ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: plataformaAtiva === nome ? 700 : 600, fontSize: 13.5,
            borderBottom: plataformaAtiva === nome ? "2px solid var(--accent)" : "2px solid transparent",
          }}
        >
          {nome} <span style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 12 }}>· {count}</span>
        </button>
      ))}
    </div>
  );

  const idsUrgentesAtual = criativosUrgentes.map((c) => c.id).sort().join(",");
  const bannerFechado = bannerUrgenciaFechadoIds === idsUrgentesAtual;

  const urgenciaBanner = criativosUrgentes.length > 0 && !bannerFechado && (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 16,
        borderRadius: 10, border: "1px solid rgba(199,127,26,0.35)", background: "rgba(199,127,26,0.1)", color: "#c77f1a",
      }}
    >
      <WarningIcon />
      <strong style={{ fontSize: 13.5, flex: 1 }}>
        {criativosUrgentes.length} criativo{criativosUrgentes.length === 1 ? "" : "s"} precisa{criativosUrgentes.length === 1 ? "" : "m"} ser implementado{criativosUrgentes.length === 1 ? "" : "s"} hoje ou amanhã.
      </strong>
      <button
        type="button"
        onClick={() => setBannerUrgenciaFechadoIds(idsUrgentesAtual)}
        title="Dispensar (continua no sino de notificações)"
        aria-label="Fechar aviso"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", border: "none", background: "transparent", color: "#c77f1a", cursor: "pointer", flexShrink: 0 }}
      >
        <XIcon />
      </button>
    </div>
  );

  // Props comuns do CreativeGridCard (grade e foco usam exatamente as mesmas --
  // reaproveita 100% das acoes ja testadas, so muda o container ao redor).
  function propsDoCard(c) {
    return {
      creative: c,
      urgente: isUrgente(c.periodo_inicio),
      onOpenDetail: setViewing,
      onEdit: openEdit,
      onDuplicate: openDuplicate,
      onDelete: setDeleting,
      canEdit: true,
      statusOptions: STATUS_OPTIONS_AGENCIA,
      onStatusChange: handleStatusChange,
      updatingStatus: updatingId === c.id,
      performance: performanceMap[c.id],
      selectable: comparando || editandoEmMassa,
      selected: selecionados.includes(c.id),
      onToggleSelect: toggleSelect,
    };
  }

  const focoAtivo = modoCards === "foco" && filteredOrdenado.find((c) => c.id === focoCreativeId);

  const viewToggle = campanhaId && filteredOrdenado.length > 0 && (
    <div style={{ display: "flex", background: "var(--bg)", borderRadius: 10, padding: 3, gap: 2, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setModoCards("grade")}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: modoCards === "grade" ? "var(--card-bg)" : "transparent",
          color: modoCards === "grade" ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: 600, fontSize: 12,
          boxShadow: modoCards === "grade" ? "0 1px 3px rgba(10,16,32,0.1)" : "none",
        }}
      >
        <GridIcon /> Grade
      </button>
      <button
        type="button"
        onClick={() => {
          if (!focoCreativeId && filteredOrdenado[0]) setFocoCreativeId(filteredOrdenado[0].id);
          setModoCards("foco");
        }}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          background: modoCards === "foco" ? "var(--card-bg)" : "transparent",
          color: modoCards === "foco" ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: 600, fontSize: 12,
          boxShadow: modoCards === "foco" ? "0 1px 3px rgba(10,16,32,0.1)" : "none",
        }}
      >
        <FocusIcon /> Foco
      </button>
    </div>
  );

  const gridConteudo = !creatives ? <Spinner /> : (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 600 }}>
          {focoAtivo ? focoAtivo.nome : `${filteredOrdenado.length} criativo${filteredOrdenado.length === 1 ? "" : "s"}`}
        </span>
        {viewToggle}
      </div>

      {focoAtivo ? (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ width: 360 }}>
            <CreativeFocusCard
              key={focoAtivo.id}
              creative={focoAtivo}
              onEdit={openEdit}
              onDuplicate={openDuplicate}
              onDelete={setDeleting}
              canEdit
              statusOptions={STATUS_OPTIONS_AGENCIA}
              onStatusChange={handleStatusChange}
              updatingStatus={updatingId === focoAtivo.id}
              performance={performanceMap[focoAtivo.id]}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredOrdenado.map((c) => (
              <div
                key={c.id}
                onClick={() => setFocoCreativeId(c.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  background: c.id === focoAtivo.id ? "var(--accent-soft)" : "var(--card-bg)",
                  border: `1px solid ${c.id === focoAtivo.id ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 10, padding: "7px 10px",
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: "var(--bg)" }}>
                  {c.cloudinary_url && (
                    c.tipo_midia === "video" ? (
                      <video src={c.cloudinary_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <img src={c.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</strong>
                  <span style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>{c.plataforma || c.veiculo}</span>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: performanceMap[c.id]?.investimento ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {performanceMap[c.id]?.investimento
                    ? Number(performanceMap[c.id].investimento).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Com "Todas" selecionado na sidebar, agrupa por plataforma com um
              cabecalho de secao (Meta Ads, Google Ads, ...) -- sem isso a
              grade misturava plataformas diferentes sem nenhuma separacao
              visual. Ao filtrar uma plataforma especifica, ha so 1 grupo
              (o cabecalho fica redundante com a sidebar, entao some). */}
          {gruposPlataforma.map(([nome, itens]) => (
            <div key={nome || "sem-plataforma"} style={{ marginBottom: 22 }}>
              {!plataformaAtiva && nome && (
                <p style={{ margin: "0 0 10px", fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
                  {nome}
                  <span style={{ fontWeight: 500 }}>· {itens.length}</span>
                </p>
              )}
              <CreativeCardGrid minWidth={480}>
                {itens.map((c) => (
                  <CreativeGridCard key={c.id} {...propsDoCard(c)} layout="horizontal" />
                ))}
              </CreativeCardGrid>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="card" style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: 12 }}>
              {creatives.length === 0 ? "Nenhum criativo cadastrado ainda" : "Nenhum criativo encontrado para os filtros selecionados"}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Desktop: sidebar de filtros (Status/Plataforma/Verba) ao lado do
  // conteudo -- so no modo Grade/Foco (fora daqui, no Kanban, continua o
  // layout antigo de pills horizontais + statusGrid, ver mais abaixo).
  const grid = campanhaId ? (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      {creatives && (
        // paddingTop alinha o titulo "Status" com a linha "N criativos" +
        // toggle Grade/Foco do gridConteudo ao lado -- sem isso a sidebar
        // comecava mais alto (fonte menor, sem o toggle por cima), parecendo
        // desalinhada/desconectada do conteudo.
        <div style={{ paddingTop: 6 }}>
          <MatrixSidebarFilters
            statusCounts={statusCounts}
            filtrosStatus={filters.status}
            onToggleStatus={(status) => setStatus(filters.status.includes(status) ? filters.status.filter((s) => s !== status) : [...filters.status, status])}
            plataformasCounts={abasPlataforma}
            plataformaAtiva={plataformaAtiva}
            onSelecionarPlataforma={selecionarAbaPlataforma}
            totalCreativos={creatives?.length || 0}
            verbaPlanejada={verbaPlanejada}
            verbaRealizada={verbaRealizada}
          />
        </div>
      )}
      {gridConteudo}
    </div>
  ) : gridConteudo;

  // Kanban usa os mesmos status permitidos ao papel do usuario (veiculo tem
  // um subconjunto) -- arrastar para uma coluna fora desse conjunto nunca
  // aparece como opcao, e mesmo assim a API valida de novo do lado do servidor.
  const statusOptionsAtual = user?.papel === "veiculo" ? STATUS_OPTIONS_VEICULO : STATUS_OPTIONS_AGENCIA;

  const kanbanBoard = !creatives ? <Spinner /> : (
    <KanbanBoard
      items={filteredOrdenado}
      statusOptions={statusOptionsAtual}
      statusColors={STATUS_COLORS}
      renderCard={(c) => (
        <CreativeGridCard
          creative={c}
          urgente={isUrgente(c.periodo_inicio)}
          onOpenDetail={setViewing}
          onEdit={openEdit}
          onDuplicate={openDuplicate}
          onDelete={setDeleting}
          canEdit
          statusOptions={statusOptionsAtual}
          onStatusChange={handleStatusChange}
          updatingStatus={updatingId === c.id}
          performance={performanceMap[c.id]}
          esconderStatusBadge
          modoKanban
        />
      )}
      onMoveCard={handleKanbanMove}
      error={kanbanError}
      onErrorClear={() => setKanbanError("")}
    />
  );

  // Chips de status clicaveis: alem de mostrar a contagem, clicar aplica o
  // filtro de status daquele valor (toggle -- clicar de novo remove) --
  // transforma o resumo num atalho de filtro em vez de so um numero estatico.
  // Barra contextual que aparece acima dos cards, alinhada a direita, quando
  // um modo de selecao em lote (comparar ou editar em massa) esta ativo --
  // antes isso ficava misturado dentro do ActionsRail (a esquerda), longe
  // dos cards que a selecao afeta.
  const selecaoBarra = modoSelecaoAtivo && (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
      <button
        type="button"
        onClick={comparando ? handleCompararClick : handleEditarEmMassaClick}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
          border: `1px solid ${comparando ? COR_COMPARAR : COR_EDITAR_MASSA}`, background: "transparent", color: comparando ? COR_COMPARAR : COR_EDITAR_MASSA,
        }}
      >
        <XIcon /> Cancelar seleção ({selecionados.length})
      </button>
      {comparando && selecionados.length >= 2 && (
        <button
          type="button"
          onClick={() => setComparativoAberto(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "none", background: COR_COMPARAR, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <CompareIcon /> Comparar agora ({selecionados.length})
        </button>
      )}
      {editandoEmMassa && selecionados.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setBulkModalAberto(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "none", background: COR_EDITAR_MASSA, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <EditIcon /> Editar {selecionados.length} criativo(s)
          </button>
          <button
            type="button"
            onClick={() => setBulkDeleting(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <TrashIcon /> Excluir {selecionados.length} criativo(s)
          </button>
        </>
      )}
    </div>
  );

  const verbaTotalBadge = creatives && verbaPlanejada > 0 && (
    <div style={{ display: "flex", alignItems: "center", gap: 24, minHeight: 44, padding: "0 26px", borderRadius: 999, background: "var(--card-bg)", border: "1px solid var(--border)", width: "fit-content", flexShrink: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {verbaPlanejada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Verba total
        </span>
      </div>
      <div style={{ width: 260, height: 8, borderRadius: 999, background: "var(--border)", overflow: "hidden", flexShrink: 0 }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, (verbaRealizada / verbaPlanejada) * 100)}%`,
            borderRadius: 999,
            background: verbaRealizada > verbaPlanejada ? "var(--danger)" : "var(--success)",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: verbaRealizada > verbaPlanejada ? "var(--danger)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {verbaRealizada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Gasto
        </span>
      </div>
    </div>
  );

  const statusGrid = creatives && (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {Object.entries(statusCounts).map(([status, count]) => {
        const cor = STATUS_COLORS[status] || { color: "var(--text-secondary)", bg: "var(--border)" };
        const ativo = filters.status.includes(status);
        return (
          <button
            key={status}
            type="button"
            onClick={() => setStatus(ativo ? filters.status.filter((s) => s !== status) : [...filters.status, status])}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 8px 12px", borderRadius: 999,
              border: `1px solid ${ativo ? cor.color : "var(--border)"}`,
              background: ativo ? cor.bg : "var(--card-bg)",
              cursor: "pointer", transition: "background 0.15s ease, border-color 0.15s ease",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{status}</span>
            <span
              style={{
                minWidth: 20, height: 20, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                background: ativo ? cor.color : "var(--bg)", color: ativo ? "#fff" : cor.color, fontSize: 11, fontWeight: 700, padding: "0 5px",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
      </div>
      {verbaTotalBadge}
    </div>
  );

  const syncFeedback = syncResult && (
    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
      {syncResult.criativosAlterados} criativo(s) atualizado(s) de {syncResult.criativosAvaliados} avaliado(s).
    </p>
  );

  const modals = (
    <>
      {modalOpen && (
        <CreativeFormModal
          key={editing?.id || "novo"}
          creative={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={load}
        />
      )}
      {bulkModalAberto && (
        <BulkEditModal
          creatives={(creatives || []).filter((c) => selecionados.includes(c.id))}
          onClose={() => setBulkModalAberto(false)}
          onSaved={handleBulkSaved}
        />
      )}
      {bulkHistoryAberto && (
        <BulkEditHistoryPanel
          onClose={() => setBulkHistoryAberto(false)}
          onUndone={() => { load(); loadBulkOperationsCount(); }}
        />
      )}
      {exportExcelAberto && (
        <GerarPlanilhaModal campanhaId={campanhaId} onClose={() => setExportExcelAberto(false)} />
      )}
      {viewing && (
        <CreativeFusedDetailModal
          creative={viewing}
          campanhaId={campanhaId}
          abaInicial={viewingAbaInicial}
          onNavegar={setViewing}
          listaNavegacao={filteredOrdenado}
          onClose={() => { setViewing(null); setViewingAbaInicial("implementacao"); }}
        />
      )}
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
            {syncButton}{compareButton}{abrirComparativoButton}{editarEmMassaButton}{bulkHistoryButton}{editarEmMassaBarra}
          </div>
        )}
        {syncFeedback}
        {urgenciaBanner}
        {statusGrid}
        {visualizacao === "kanban" ? kanbanBoard : grid}
        {modals}
      </div>
    );
  }

  // Esconde a barra flutuante enquanto qualquer modal/drawer da tela estiver
  // aberto -- inclusive o Historico, que a TopNav renderiza fora desta view
  // (por isso o overlayAberto vem do contexto compartilhado em vez de um
  // estado local aqui).
  const algumOverlayAberto = overlayAberto || modalOpen || !!editing || !!deleting || !!viewing
    || bulkModalAberto || bulkHistoryAberto || !!bulkDeleting || comparativoAberto || exportExcelAberto;

  return (
    <div>
      <ActionsRail items={railItems} hidden={algumOverlayAberto} />
      {syncResult && <div style={{ textAlign: "right" }}>{syncFeedback}</div>}
      {urgenciaBanner}
      {selecaoBarra}
      {visualizacao === "kanban" ? (
        <>
          {statusGrid}
          {kanbanBoard}
        </>
      ) : grid}
      {modals}
    </div>
  );
}
