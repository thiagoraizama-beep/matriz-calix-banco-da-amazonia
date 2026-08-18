import { useEffect, useState } from "react";
import {
  TransactionIcon,
  LogoutIcon,
  ChevronIcon,
} from "./navIcons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import Avatar from "../common/Avatar.jsx";
import useIsMobile from "../../hooks/useIsMobile.js";

const SIDEBAR_LOGOS = {
  expanded: { light: "/RGB_logo_horizontal_verde_escuro.png", dark: "/RGB_logo_horizontal_branco.png" },
  collapsed: { light: "/RGB_logo_vertical_.png", dark: "/RGB_logo_vertical_.png" },
};

export const PAGES = {
  MATRIZ_CONTEUDO: "Matriz de Conteúdo",
  A_IMPLEMENTAR: "A implementar",
  PERFIL: "Perfil",
  ADMIN: "Visão do Administrador",
};

// Rotulo exibido no rodape da sidebar em vez do nome cru do papel do usuario.
// - agencia: nome da agencia que opera o dashboard
// - cliente: nome do cliente dono do dashboard (Banco da Amazonia)
// - veiculo/parceiro: nome do(s) veiculo(s) vinculados ao cadastro do usuario
function papelLabel(user) {
  if (user.papel === "agencia") return "Cálix Propagandas";
  if (user.papel === "cliente") return "Banco da Amazônia";
  if (user.papel === "veiculo" || user.papel === "parceiro") {
    return user.veiculos?.length ? user.veiculos.join(", ") : "Veículo";
  }
  return user.papel;
}

const STORAGE_KEY = "sidebar-collapsed";

export const SIDEBAR_WIDTH_EXPANDED = 260;
export const SIDEBAR_WIDTH_COLLAPSED = 72;

export default function Sidebar({ collapsed: collapsedProp, onToggle, activePage, onNavigate, user, mobileOpen, onCloseMobile }) {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const matrixActive = activePage === PAGES.MATRIZ_CONTEUDO;
  const matrixLabel = user?.papel === "cliente" ? "Relatório de Criativos" : PAGES.MATRIZ_CONTEUDO;
  const isMobile = useIsMobile();
  // No mobile a sidebar sempre se comporta como expandida (largura total em drawer),
  // independente do estado de colapso salvo do desktop.
  const collapsed = isMobile ? false : collapsedProp;

  function handleNavigate(page) {
    onNavigate(page);
    if (isMobile) onCloseMobile?.();
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,14,25,0.5)",
            zIndex: 19,
          }}
        />
      )}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: isMobile ? SIDEBAR_WIDTH_EXPANDED : collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          background: "var(--card-bg)",
          boxShadow: "1px 0 3px rgba(20,33,61,0.06)",
          display: "flex",
          flexDirection: "column",
          transition: isMobile ? "transform 0.2s ease" : "width 0.2s ease",
          transform: isMobile && !mobileOpen ? "translateX(-100%)" : "translateX(0)",
          zIndex: 20,
          overflow: "hidden",
        }}
      >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: "24px 16px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <img
          src={collapsed ? SIDEBAR_LOGOS.collapsed[theme] : SIDEBAR_LOGOS.expanded[theme]}
          alt="BSLI3.SA"
          style={{
            height: collapsed ? 26 : 34,
            maxWidth: "100%",
            objectFit: "contain",
            borderRadius: collapsed ? 6 : 0,
          }}
        />
        {isMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        )}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, padding: "20px 12px 12px", flex: 1, overflowY: "auto" }}>
        <div
          title={collapsed ? matrixLabel : undefined}
          onClick={() => handleNavigate(PAGES.MATRIZ_CONTEUDO)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 10,
            cursor: "pointer",
            color: matrixActive ? "var(--accent)" : "var(--text-secondary)",
            background: matrixActive ? "var(--accent-soft)" : "transparent",
            fontWeight: matrixActive ? 600 : 400,
            whiteSpace: "nowrap",
          }}
        >
          <TransactionIcon />
          {!collapsed && <span>{matrixLabel}</span>}
        </div>

        {(user?.papel === "agencia" || user?.papel === "veiculo") && (
          <div
            title={collapsed ? PAGES.A_IMPLEMENTAR : undefined}
            onClick={() => handleNavigate(PAGES.A_IMPLEMENTAR)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 10,
              cursor: "pointer",
              color: activePage === PAGES.A_IMPLEMENTAR ? "var(--accent)" : "var(--text-secondary)",
              background: activePage === PAGES.A_IMPLEMENTAR ? "var(--accent-soft)" : "transparent",
              fontWeight: activePage === PAGES.A_IMPLEMENTAR ? 600 : 400,
              whiteSpace: "nowrap",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {!collapsed && <span>{PAGES.A_IMPLEMENTAR}</span>}
          </div>
        )}

        <div
          title={collapsed ? "Configurações" : undefined}
          onClick={() => handleNavigate(PAGES.PERFIL)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 10,
            cursor: "pointer",
            color: activePage === PAGES.PERFIL ? "var(--accent)" : "var(--text-secondary)",
            background: activePage === PAGES.PERFIL ? "var(--accent-soft)" : "transparent",
            fontWeight: activePage === PAGES.PERFIL ? 600 : 400,
            whiteSpace: "nowrap",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {!collapsed && <span>Configurações</span>}
        </div>
      </nav>

      {user && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 8,
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            onClick={() => handleNavigate(PAGES.PERFIL)}
            title={collapsed ? "Perfil" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", cursor: "pointer" }}
          >
            <Avatar nome={user.nome} fotoUrl={user.fotoUrl} size={36} />
            {!collapsed && (
              <div style={{ overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.nome}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>
                  {papelLabel(user)}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title="Sair"
            aria-label="Sair"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--danger)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <LogoutIcon />
          </button>
        </div>
      )}

      {!isMobile && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Encolher menu"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            margin: 12,
            padding: "10px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <ChevronIcon collapsed={collapsed} />
        </button>
      )}
      </aside>
    </>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return [collapsed, () => setCollapsed((c) => !c)];
}
