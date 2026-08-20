import { useState, useRef, useEffect } from "react";

function PlusFabIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

// Botao redondo flutuante (FAB) no canto inferior esquerdo -- clicar abre um
// menu compacto com as acoes da Matriz (Novo criativo, Sincronizar, Editar
// em massa, Comparar, Ultimas edicoes). Substitui a faixa lateral de altura
// total (rejeitada -- "muito quadrado"/"nao e isso"): nao ocupa espaco fixo
// nenhum enquanto fechado, so aparece por cima quando aberto.
// items: [{ key, icon, label, onClick, tone: 'default'|'accent'|'solid', badge, disabled }]
// hidden: some o FAB por completo -- reforco pra overlays que cubram a tela
// inteira (ex: modais centralizados).
export default function ActionsRail({ items, hidden = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const visiveis = items.filter(Boolean);
  useClickOutside(ref, () => setOpen(false));

  if (visiveis.length === 0 || hidden) return null;

  const totalBadge = visiveis.reduce((acc, item) => acc + (item.badge > 0 ? item.badge : 0), 0);

  return (
    <div ref={ref} style={{ position: "fixed", bottom: 24, left: 24, zIndex: 150 }}>
      {open && (
        <div
          style={{
            position: "absolute", bottom: "calc(100% + 10px)", left: 0, minWidth: 210,
            background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14,
            boxShadow: "0 12px 32px rgba(20,33,61,0.18)", padding: 6,
            display: "flex", flexDirection: "column", gap: 2,
          }}
        >
          {visiveis.map((item) => (
            <RailItem key={item.key} item={item} onClick={() => { item.onClick(); setOpen(false); }} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Ações"
        style={{
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
          width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "var(--accent)", color: "#fff", boxShadow: "0 6px 18px rgba(20,33,61,0.22)",
          transform: open ? "rotate(45deg)" : "none", transition: "transform 0.18s ease",
        }}
      >
        <PlusFabIcon />
        {!open && totalBadge > 0 && (
          <span
            style={{
              position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, padding: "0 3px",
              borderRadius: 999, background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--card-bg)",
            }}
          >
            {totalBadge}
          </span>
        )}
      </button>
    </div>
  );
}

function RailItem({ item, onClick }) {
  const { icon, label, tone = "default", badge, disabled } = item;
  const cores = {
    default: { color: "var(--text-primary)" },
    accent: { color: "var(--accent)" },
    solid: { color: "var(--accent)" },
    danger: { color: "var(--danger)" },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 10,
        padding: "9px 10px", borderRadius: 9, border: "none",
        background: "transparent", color: cores.color,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
        fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
        justifyContent: "flex-start", width: "100%",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--bg)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
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
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </button>
  );
}
