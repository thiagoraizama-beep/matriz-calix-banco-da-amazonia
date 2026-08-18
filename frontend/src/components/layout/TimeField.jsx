import { useEffect, useRef, useState } from "react";

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, "0"));

// Seletor de horario (HH:mm) estilizado, no mesmo padrao visual do DateField --
// substitui o <input type="time"> nativo do navegador, cujo widget varia e nao
// segue o tema do app. Duas colunas de scroll (hora / minuto, em passos de 5min).
export default function TimeField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const [hh, mm] = (value || "00:00").split(":");

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
      const width = 140;
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      setMenuPos({ top: rect.bottom + 8, left: Math.max(8, left) });
    }
  }

  function handleToggleOpen() {
    if (!open) updateMenuPosition();
    setOpen((o) => !o);
  }

  function selectHour(h) {
    onChange(`${h}:${mm}`);
  }

  function selectMinute(m) {
    onChange(`${hh}:${m}`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleToggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
          color: "var(--text-primary)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <ClockIcon />
        {hh}:{mm}
      </button>

      {open && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            width: 140,
            zIndex: 9999,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(20,33,61,0.18)",
            display: "flex",
            overflow: "hidden",
          }}
        >
          <div style={{ flex: 1, maxHeight: 200, overflowY: "auto", borderRight: "1px solid var(--border)" }}>
            {HOURS.map((h) => (
              <div
                key={h}
                onClick={() => selectHour(h)}
                style={{
                  padding: "8px 0",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: h === hh ? 700 : 400,
                  color: h === hh ? "#fff" : "var(--text-primary)",
                  background: h === hh ? "var(--accent)" : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (h !== hh) e.currentTarget.style.background = "var(--accent-soft)"; }}
                onMouseLeave={(e) => { if (h !== hh) e.currentTarget.style.background = "transparent"; }}
              >
                {h}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, maxHeight: 200, overflowY: "auto" }}>
            {MINUTES.map((m) => (
              <div
                key={m}
                onClick={() => selectMinute(m)}
                style={{
                  padding: "8px 0",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: m === mm ? 700 : 400,
                  color: m === mm ? "#fff" : "var(--text-primary)",
                  background: m === mm ? "var(--accent)" : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (m !== mm) e.currentTarget.style.background = "var(--accent-soft)"; }}
                onMouseLeave={(e) => { if (m !== mm) e.currentTarget.style.background = "transparent"; }}
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
