function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export default function MobileTopBar({ onOpenMenu, children }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 15,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "10px 12px",
        background: "var(--card-bg)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(20,33,61,0.08)",
      }}
    >
      <button
        onClick={onOpenMenu}
        aria-label="Abrir menu"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-primary)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <MenuIcon />
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>
    </div>
  );
}
