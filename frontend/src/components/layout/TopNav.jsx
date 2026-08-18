import { useEffect, useState } from "react";
import { LogoutIcon } from "./navIcons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import SlidingToggle from "./SlidingToggle.jsx";
import NotificationBell from "./NotificationBell.jsx";
import Avatar from "../common/Avatar.jsx";
import useIsMobile from "../../hooks/useIsMobile.js";
import { PAGES } from "./Sidebar.jsx";
import { useMatrixFiltersContext } from "../../context/MatrixFiltersContext.jsx";
import { useCampanhasHomeFiltersContext } from "../../context/CampanhasHomeFiltersContext.jsx";
import MultiSelectDropdown from "./MultiSelectDropdown.jsx";
import { papelLabel } from "../../utils/papelLabel.js";
import { STATUS_LABEL, STATUS_OPTIONS } from "../../utils/campanhaStatus.js";
import ActionLogModal from "../contentMatrix/AgencyView/ActionLogModal.jsx";
import RascunhosModal from "../contentMatrix/AgencyView/RascunhosModal.jsx";
import { getCreativesAImplementar, getMeusRascunhos } from "../../api/client.js";

const A_IMPLEMENTAR_POLL_MS = 60_000;

const STATUS_KEY_BY_LABEL = Object.fromEntries(STATUS_OPTIONS.map((key) => [STATUS_LABEL[key], key]));

const TOPNAV_LOGOS = {
  light: "/RGB_logo_horizontal_verde_escuro.png",
  dark: "/RGB_logo_horizontal_branco.png",
};

export const TOPNAV_HEIGHT = 64;

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16l-6 8v6l-4-2v-4z" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function CompareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3v18M15 3v18M4 8h5M4 16h5M15 8h5M15 16h5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function KanbanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="12" rx="1" />
      <rect x="17" y="3" width="5" height="8" rx="1" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export default function TopNav({ activePage, onNavigate, user, showMatrixFilters, showCampanhasFilters, showVoltar, onVoltar, campanhaId }) {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionLogAberto, setActionLogAberto] = useState(false);
  const [rascunhosAberto, setRascunhosAberto] = useState(false);
  const [totalRascunhos, setTotalRascunhos] = useState(0);
  const matrixFilters = useMatrixFiltersContext();
  const campanhasFilters = useCampanhasHomeFiltersContext();
  const matrixLabel = user?.papel === "cliente" ? "Relatório de Criativos" : PAGES.MATRIZ_CONTEUDO;
  const [totalAImplementar, setTotalAImplementar] = useState(0);
  // Toggle Grade/Kanban no menu do usuario -- so aparece quando a tela ativa
  // tem uma visualizacao alternativa (Matriz dentro de campanha, ou Home de
  // Campanhas), usando o mesmo criterio das props que ja controlam os filtros.
  const visualizacaoAtual = showMatrixFilters && matrixFilters
    ? matrixFilters
    : showCampanhasFilters && campanhasFilters
    ? campanhasFilters
    : null;

  useEffect(() => {
    if (user?.papel !== "agencia" && user?.papel !== "veiculo") return;
    function carregar() {
      getCreativesAImplementar().then((lista) => setTotalAImplementar(lista.length)).catch(() => {});
    }
    carregar();
    const interval = setInterval(carregar, A_IMPLEMENTAR_POLL_MS);
    return () => clearInterval(interval);
  }, [user?.papel]);

  function carregarRascunhos() {
    if (user?.papel !== "agencia") return;
    getMeusRascunhos().then((lista) => setTotalRascunhos(lista.length)).catch(() => {});
  }

  useEffect(() => {
    carregarRascunhos();
  }, [user?.papel]);

  function handleNavigate(page) {
    onNavigate(page);
    setMenuOpen(false);
  }

  if (isMobile) {
    // No mobile mantem o padrao existente (MobileTopBar) -- TopNav e so a variante desktop.
    return null;
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 20 }}>
    <header
      style={{
        height: TOPNAV_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "0 24px",
        background: "var(--card-bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <img
          src={TOPNAV_LOGOS[theme]}
          alt="Banco da Amazônia"
          style={{ height: 26, objectFit: "contain", flexShrink: 0 }}
        />

        <div style={{ width: 1, height: 30, background: "var(--border)" }} />

        <button
          onClick={() => handleNavigate(PAGES.MATRIZ_CONTEUDO)}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", fontWeight: 700 }}>
            {papelLabel(user)}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            {matrixLabel}
          </span>
        </button>

        {showVoltar && (
          <button
            onClick={onVoltar}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px 7px 8px",
              borderRadius: 999, border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
            }}
          >
            <ArrowLeftIcon />
            Campanhas
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {showMatrixFilters && matrixFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 1 560px", minWidth: 0, justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "8px 14px",
              flex: 1,
              minWidth: 0,
            }}
          >
            <span style={{ color: "var(--text-secondary)", display: "flex" }}>
              <SearchIcon />
            </span>
            <input
              value={matrixFilters.busca}
              onChange={(e) => matrixFilters.setBusca(e.target.value)}
              placeholder="Buscar criativo ou campanha..."
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--text-primary)", width: "100%" }}
            />
          </div>

          <div style={{ position: "relative" }}>
            {(() => {
              const matrixFilterAtivo =
                matrixFilters.status.length > 0 ||
                matrixFilters.veiculo.length > 0 ||
                matrixFilters.plataforma.length > 0 ||
                matrixFilters.modeloCompra.length > 0;
              return (
                <button
                  onClick={() => setFilterOpen((o) => !o)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: `1px solid ${filterOpen || matrixFilterAtivo ? "var(--accent)" : "var(--border)"}`,
                    background: filterOpen ? "var(--accent-soft)" : "transparent",
                    color: filterOpen || matrixFilterAtivo ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <FilterIcon />
                  Filtro
                  {matrixFilterAtivo && (
                    <span style={{ minWidth: 16, height: 16, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                      {matrixFilters.status.length + matrixFilters.veiculo.length + matrixFilters.plataforma.length + matrixFilters.modeloCompra.length}
                    </span>
                  )}
                </button>
              );
            })()}

            {filterOpen && (
              <>
                <div onClick={() => setFilterOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 24 }} />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: 260,
                    background: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
                    padding: 14,
                    zIndex: 25,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Plataforma</label>
                    <MultiSelectDropdown multi value={matrixFilters.plataforma} onChange={matrixFilters.setPlataforma} options={matrixFilters.matrixOptions.plataformas} placeholder="Todas as plataformas" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Veículo</label>
                    <MultiSelectDropdown multi value={matrixFilters.veiculo} onChange={matrixFilters.setVeiculo} options={matrixFilters.matrixOptions.veiculos} placeholder="Todos os veículos" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Modelo de compra</label>
                    <MultiSelectDropdown multi value={matrixFilters.modeloCompra} onChange={matrixFilters.setModeloCompra} options={matrixFilters.matrixOptions.modelosCompra} placeholder="Todos os modelos" />
                  </div>
                  {(matrixFilters.status.length > 0 || matrixFilters.veiculo.length > 0 || matrixFilters.plataforma.length > 0 || matrixFilters.modeloCompra.length > 0) && (
                    <button
                      onClick={() => {
                        matrixFilters.setStatus([]);
                        matrixFilters.setVeiculo([]);
                        matrixFilters.setPlataforma([]);
                        matrixFilters.setModeloCompra([]);
                      }}
                      style={{
                        padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent",
                        color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showCampanhasFilters && campanhasFilters && !campanhasFilters.comparativoAberto && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 1 620px", minWidth: 0, justifyContent: "center" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "var(--bg)",
              border: "1px solid var(--border)", borderRadius: 999, padding: "8px 14px", flex: "0 1 280px", minWidth: 0,
            }}
          >
            <span style={{ color: "var(--text-secondary)", display: "flex" }}><SearchIcon /></span>
            <input
              value={campanhasFilters.busca}
              onChange={(e) => campanhasFilters.setBusca(e.target.value)}
              placeholder="Buscar campanha..."
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--text-primary)", width: "100%" }}
            />
          </div>
          <div style={{ flex: "0 0 160px" }}>
            <MultiSelectDropdown
              value={STATUS_LABEL[campanhasFilters.status] || null}
              onChange={(label) => campanhasFilters.setStatus(label ? STATUS_KEY_BY_LABEL[label] : "")}
              options={STATUS_OPTIONS.map((key) => STATUS_LABEL[key])}
              placeholder="Status"
              compact
              pill
            />
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 16 }}>
        {(user?.papel === "agencia" || user?.papel === "veiculo") && (
          <button
            onClick={() => handleNavigate(PAGES.A_IMPLEMENTAR)}
            title={PAGES.A_IMPLEMENTAR}
            style={{
              position: "relative",
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999,
              border: `1px solid ${activePage === PAGES.A_IMPLEMENTAR ? "var(--accent)" : "var(--border)"}`,
              background: activePage === PAGES.A_IMPLEMENTAR ? "var(--accent-soft)" : "transparent",
              color: activePage === PAGES.A_IMPLEMENTAR ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", marginRight: 6,
            }}
          >
            <WarningIcon />
            A implementar
            {totalAImplementar > 0 && (
              <span
                style={{
                  position: "absolute", top: -6, right: -6, minWidth: 16, height: 16, borderRadius: "50%",
                  background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                }}
              >
                {totalAImplementar}
              </span>
            )}
          </button>
        )}
        {(campanhaId || showCampanhasFilters) && user?.papel === "agencia" && (
          <button
            onClick={() => setActionLogAberto(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999,
              border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", marginRight: 6,
            }}
          >
            <HistoryIcon />
            Histórico
          </button>
        )}
        {actionLogAberto && (
          <ActionLogModal
            campanhaId={campanhaId}
            global={!campanhaId && showCampanhasFilters}
            onClose={() => setActionLogAberto(false)}
          />
        )}
        {rascunhosAberto && (
          <RascunhosModal
            onClose={() => { setRascunhosAberto(false); carregarRascunhos(); }}
          />
        )}
        <NotificationBell variant="plain" />

        <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 6px" }} />

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "4px 10px 4px 4px",
              borderRadius: 999,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <Avatar nome={user?.nome} fotoUrl={user?.fotoUrl} size={36} />
            {user && (
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.nome}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.3, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {papelLabel(user)}
                </p>
              </div>
            )}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-secondary)"
              strokeWidth="2"
              style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 24 }} />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  minWidth: 220,
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
                  padding: 8,
                  zIndex: 25,
                }}
              >
                <p style={{ margin: "2px 10px 6px", fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Preferências
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--bg)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                      <ThemeIcon />
                      Tema
                    </span>
                    <ThemeToggle variant="plain" />
                  </div>
                  {visualizacaoAtual && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--bg)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                        {visualizacaoAtual.visualizacao === "grade" ? <GridIcon /> : <KanbanIcon />}
                        Visualização
                      </span>
                      <SlidingToggle
                        active={visualizacaoAtual.visualizacao === "grade" ? "left" : "right"}
                        onToggle={() => visualizacaoAtual.setVisualizacao(visualizacaoAtual.visualizacao === "grade" ? "kanban" : "grade")}
                        iconLeft={<GridIcon />}
                        iconRight={<KanbanIcon />}
                        titleLeft="Ver em Grade"
                        titleRight="Ver em Kanban"
                      />
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />

                {user?.papel === "agencia" && (
                  <button
                    onClick={() => { setRascunhosAberto(true); setMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8,
                      padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent",
                      color: "var(--text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <DraftIcon />
                      Meus rascunhos
                    </span>
                    {totalRascunhos > 0 && (
                      <span style={{ minWidth: 18, height: 18, borderRadius: "50%", background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", flexShrink: 0 }}>
                        {totalRascunhos}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleNavigate(PAGES.PERFIL)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    gap: 8,
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: activePage === PAGES.PERFIL ? "var(--accent-soft)" : "transparent",
                    color: activePage === PAGES.PERFIL ? "var(--accent)" : "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <SettingsIcon />
                  Configurações
                </button>
                <button
                  onClick={logout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    gap: 8,
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "var(--danger)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <LogoutIcon />
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    </div>
  );
}
