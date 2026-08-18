import { useEffect, useRef, useState } from "react";
import { STATUS_OPTIONS, STATUS_LABEL, STATUS_BADGE_CLASS } from "../../utils/campanhaStatus.js";

function ChevronDownIcon({ color }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Dropdown de status estilizado como badge, no mesmo padrao visual dos demais
// menus flutuantes do projeto (MultiSelectDropdown/RangeCalendarPicker).
export default function CampaignStatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function updateMenuPosition() {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.max(rect.width, 160);
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      setMenuRect({ top: rect.bottom + 6, left: Math.max(8, left), width });
    }
  }

  function handleToggleOpen() {
    if (!open) updateMenuPosition();
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handleScrollOrResize() {
      updateMenuPosition();
    }
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  function handleSelect(status) {
    setOpen(false);
    if (status !== value) onChange(status);
  }

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`badge ${STATUS_BADGE_CLASS[value] || "badge-ativo"}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {STATUS_LABEL[value] || value}
        <ChevronDownIcon color="currentColor" />
      </button>

      {open && menuRect && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            maxWidth: "calc(100vw - 16px)",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
            zIndex: 9999,
            padding: 6,
          }}
        >
          {STATUS_OPTIONS.map((s) => {
            const selected = s === value;
            return (
              <div
                key={s}
                onClick={() => handleSelect(s)}
                style={{
                  padding: "8px 10px",
                  fontSize: 13,
                  borderRadius: 8,
                  cursor: "pointer",
                  color: selected ? "var(--accent)" : "var(--text-primary)",
                  fontWeight: selected ? 600 : 400,
                  background: selected ? "var(--accent-soft)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = "var(--accent-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = "transparent";
                }}
              >
                {STATUS_LABEL[s]}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
