import { useState } from "react";

function ChevronIcon({ open }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      style={{ transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// Barra flutuante fixa no canto direito da tela, colapsavel: fechada mostra
// so os icones das acoes (com badge quando houver), aberta mostra icone +
// rotulo. Nao empurra o layout (position: fixed, sobreposta), pensada pra
// telas com muitas acoes de toolbar (Sincronizar, Comparar, Editar em massa,
// Ultimas edicoes, Novo criativo) que ficavam poluidas numa linha horizontal.
// items: [{ key, icon, label, onClick, tone: 'default'|'accent'|'solid', badge, disabled }]
export default function ActionsRail({ items }) {
  const [open, setOpen] = useState(false);
  const visiveis = items.filter(Boolean);
  if (visiveis.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed", top: "50%", right: 20, transform: "translateY(-50%)", zIndex: 150,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
      }}
    >
      <div
        style={{
          background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 16,
          boxShadow: "0 12px 32px rgba(20,33,61,0.14)", padding: 8, display: "flex", flexDirection: "column", gap: 3,
          width: open ? 210 : "auto", transition: "width 0.18s ease",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={open ? "Recolher ações" : "Ações"}
          style={{
            display: "flex", alignItems: "center", justifyContent: open ? "space-between" : "center",
            gap: 8, padding: open ? "7px 10px" : "8px", borderRadius: 10, border: "none",
            background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
            fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          {open && "Ações"}
          <ChevronIcon open={open} />
        </button>

        {visiveis.map((item) => (
          <RailItem key={item.key} item={item} open={open} />
        ))}
      </div>
    </div>
  );
}

function RailItem({ item, open }) {
  const { icon, label, onClick, tone = "default", badge, disabled } = item;
  const cores = {
    default: { border: "transparent", bg: "transparent", color: "var(--text-primary)" },
    accent: { border: "transparent", bg: "transparent", color: "var(--accent)" },
    solid: { border: "none", bg: "var(--accent)", color: "#fff" },
    danger: { border: "transparent", bg: "transparent", color: "var(--danger)" },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={!open ? label : undefined}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 10,
        padding: open ? "9px 10px" : "9px", borderRadius: 10, border: cores.border,
        background: tone === "solid" ? cores.bg : "transparent", color: cores.color,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
        fontSize: 13, fontWeight: tone === "solid" ? 700 : 600, whiteSpace: "nowrap",
        justifyContent: open ? "flex-start" : "center", width: "100%",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => { if (!disabled && tone !== "solid") e.currentTarget.style.background = "var(--bg)"; }}
      onMouseLeave={(e) => { if (tone !== "solid") e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
        {icon}
        {badge > 0 && (
          <span
            style={{
              position: "absolute", top: -6, right: -6, minWidth: 15, height: 15, padding: "0 3px",
              borderRadius: 999, background: "var(--danger)", color: "#fff", fontSize: 9.5, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--card-bg)",
            }}
          >
            {badge}
          </span>
        )}
      </span>
      {open && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
    </button>
  );
}
