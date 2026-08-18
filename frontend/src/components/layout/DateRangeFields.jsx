import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/dist/style.css";
import { toISODate, fromISODate } from "../../utils/date.js";
import { getAvailableDateRange } from "../../api/client.js";

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

// Um campo de data individual: botao estilizado que abre um DayPicker de dia unico.
function DateField({ label, value, onChange, placeholder, disabledMatcher }) {
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
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      setMenuPos({ top: rect.bottom + 8, left: Math.max(8, left) });
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
    <div ref={containerRef} style={{ position: "relative" }}>
      {label && <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</label>}
      <button
        type="button"
        onClick={handleToggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: label ? 6 : 0,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
          color: value ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: 13,
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
          <div className="mini-calendar" style={{ display: "flex", justifyContent: "center" }}>
            <DayPicker
              mode="single"
              selected={fromISODate(value)}
              onSelect={handleSelect}
              disabled={disabledMatcher}
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

// Dois campos independentes (inicio e fim), cada um com seu proprio calendario.
// Quando isFiltered=false, os campos ficam vazios em vez de mostrar o range padrao.
// Dias fora do periodo com dados disponiveis (considerando os filtros de
// campanha/veiculo/modelo ja ativos) ficam desabilitados no calendario.
// disabledRange, quando informado, substitui o calculo automatico via
// getAvailableDateRange -- usado quando o periodo valido ja e conhecido de outra
// fonte (ex: periodo de veiculacao cadastrado na campanha).
export default function DateRangeFields({ start, end, isFiltered, campanha, veiculo, modeloCompra, disabledRange, onChange }) {
  const [availableRange, setAvailableRange] = useState({ start: null, end: null });
  const showStart = isFiltered ? start : "";
  const showEnd = isFiltered ? end : "";

  useEffect(() => {
    if (disabledRange) return;
    getAvailableDateRange(campanha, veiculo, modeloCompra)
      .then(setAvailableRange)
      .catch(() => setAvailableRange({ start: null, end: null }));
  }, [JSON.stringify(campanha), JSON.stringify(veiculo), JSON.stringify(modeloCompra), disabledRange]);

  const range = disabledRange || availableRange;
  const disabledMatcher = range.start && range.end
    ? [{ before: fromISODate(range.start), after: fromISODate(range.end) }]
    : undefined;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <DateField
        value={showStart}
        placeholder="Data inicial"
        disabledMatcher={disabledMatcher}
        onChange={(newStart) => onChange(newStart, showEnd || newStart)}
      />
      <span style={{ color: "var(--text-secondary)" }}>→</span>
      <DateField
        value={showEnd}
        placeholder="Data final"
        disabledMatcher={disabledMatcher}
        onChange={(newEnd) => onChange(showStart || newEnd, newEnd)}
      />
    </div>
  );
}
