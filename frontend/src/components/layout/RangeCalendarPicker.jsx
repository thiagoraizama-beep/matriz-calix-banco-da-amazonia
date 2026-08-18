import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import "react-day-picker/style.css";
import { toISODate, fromISODate } from "../../utils/date.js";

function formatDateBR(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export default function RangeCalendarPicker({ start, end, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [selected, setSelected] = useState({
    from: fromISODate(start),
    to: fromISODate(end),
  });
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setSelected({ from: fromISODate(start), to: fromISODate(end) });
  }, [start, end]);

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
      const width = Math.min(300, window.innerWidth - 16);
      const estimatedHeight = 360;
      // Tenta alinhar pela esquerda do botao; se nao couber, alinha pela direita
      // do botao (menu "cresce" para a esquerda em vez de vazar a tela).
      const alinhadoEsquerda = rect.left + width <= window.innerWidth - 8;
      const left = alinhadoEsquerda ? rect.left : rect.right - width;
      // Abre para cima do botao se nao houver espaco suficiente embaixo na viewport.
      const abrirParaCima = rect.bottom + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;
      const top = abrirParaCima ? Math.max(8, rect.top - estimatedHeight - 6) : rect.bottom + 6;
      setMenuPos({ top, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    }
  }

  function handleToggleOpen() {
    if (!open) updateMenuPosition();
    setOpen((o) => !o);
  }

  // Mantem o menu colado no botao enquanto a pagina rola ou a janela muda de tamanho.
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

  function handleSelect(value) {
    if (!value?.from) {
      setSelected({ from: undefined, to: undefined });
      return;
    }
    const next = { from: value.from, to: value.to || value.from };
    setSelected(next);
    // Aplica automaticamente assim que o intervalo tem inicio e fim distintos
    // (o segundo clique do usuario), sem precisar de botao "Filtrar".
    if (next.from && next.to && next.to.getTime() !== next.from.getTime()) {
      onChange(toISODate(next.from), toISODate(next.to));
      setOpen(false);
    }
  }

  const label =
    start && end ? `${formatDateBR(start)} - ${formatDateBR(end)}` : "Selecionar período";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleToggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          width: "100%",
          padding: compact ? "6px 10px" : "10px 12px",
          borderRadius: compact ? 6 : 8,
          border: "1px solid var(--border)",
          background: "var(--card-bg)",
          color: "var(--text-primary)",
          fontSize: compact ? 12 : 13,
          cursor: "pointer",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <svg width={compact ? 12 : 14} height={compact ? 12 : 14} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            maxWidth: "calc(100vw - 16px)",
            zIndex: 9999,
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
            padding: 12,
          }}
        >
          <div className="mini-calendar mini-calendar-compact" style={{ display: "flex", justifyContent: "center" }}>
            <DayPicker
              mode="range"
              selected={selected}
              onSelect={handleSelect}
              numberOfMonths={1}
              defaultMonth={selected?.to || new Date()}
              locale={ptBR}
            />
          </div>
        </div>
      )}
    </div>
  );
}

