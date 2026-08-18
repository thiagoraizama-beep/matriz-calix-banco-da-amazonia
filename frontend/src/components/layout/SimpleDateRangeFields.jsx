import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import { toISODate, fromISODate } from "../../utils/date.js";

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function formatDateBR(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function DateField({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
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
      const width = 280;
      const estimatedHeight = 310;
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      const espacoEmbaixo = window.innerHeight - rect.bottom;
      const espacoEmCima = rect.top;
      // Abre para cima do botao so quando realmente nao ha espaco suficiente embaixo
      // E ha mais espaco em cima do que embaixo -- evita o popup "pular" para longe do
      // campo quando ha so um pouco menos de espaco embaixo do que a altura estimada.
      const abrirParaCima = espacoEmbaixo < estimatedHeight && espacoEmCima > espacoEmbaixo;
      const top = abrirParaCima
        ? Math.max(8, rect.top - Math.min(estimatedHeight, espacoEmCima - 8) - 6)
        : rect.bottom + 8;
      setMenuPos({ top, left: Math.max(8, left) });
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

  function handleSelect(date) {
    if (!date) return;
    onChange(toISODate(date));
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={handleToggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: value ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: 12,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <CalendarIcon />
        {value ? formatDateBR(value) : placeholder}
      </button>

      {open && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(20,33,61,0.18)",
            padding: 14,
          }}
        >
          <div className="mini-calendar mini-calendar-compact" style={{ display: "flex", justifyContent: "center" }}>
            <DayPicker
              mode="single"
              selected={fromISODate(value)}
              onSelect={handleSelect}
              numberOfMonths={1}
              defaultMonth={fromISODate(value) || new Date()}
              locale={ptBR}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Dois campos independentes (inicio/fim), cada um com seu proprio calendario de dia
// unico -- mesmo padrao visual do DateRangeFields do Dashboard, mas sem depender de
// getAvailableDateRange (usado em contextos onde nao ha um periodo "disponivel"
// pre-calculado, como o filtro de Analise por Criativo e o Comparativo).
export default function SimpleDateRangeFields({ start, end, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <DateField value={start} placeholder="Data inicial" onChange={(newStart) => onChange(newStart, end || newStart)} />
      <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>→</span>
      <DateField value={end} placeholder="Data final" onChange={(newEnd) => onChange(start || newEnd, newEnd)} />
    </div>
  );
}
