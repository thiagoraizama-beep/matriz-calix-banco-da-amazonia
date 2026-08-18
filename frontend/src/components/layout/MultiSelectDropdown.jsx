import { useEffect, useRef, useState } from "react";

function ChevronDownIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

// value: string|null para single, string[] para multi
export default function MultiSelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Todos",
  multi = false,
  variant = "plain",
  compact = false,
  pill = false,
}) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const onImage = variant === "onImage";

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
      const width = Math.max(rect.width, 180);
      const left = Math.min(rect.left, window.innerWidth - width - 12);
      setMenuRect({ top: rect.bottom + 6, left: Math.max(8, left), width });
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

  const selectedValues = multi ? value || [] : value ? [value] : [];

  function isSelected(opt) {
    return selectedValues.includes(opt);
  }

  function handleOptionClick(opt) {
    if (!multi) {
      onChange(opt === value ? null : opt);
      setOpen(false);
      return;
    }
    const next = isSelected(opt) ? selectedValues.filter((v) => v !== opt) : [...selectedValues, opt];
    onChange(next);
  }

  function handleClearClick() {
    onChange(multi ? [] : null);
    if (!multi) setOpen(false);
  }

  const label =
    selectedValues.length === 0
      ? placeholder
      : multi
      ? selectedValues.length === 1
        ? selectedValues[0]
        : `${selectedValues.length} selecionados`
      : selectedValues[0];

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
          padding: compact ? "6px 10px" : onImage ? "8px 14px" : "10px 12px",
          borderRadius: onImage || pill ? 999 : 8,
          border: onImage ? "1px solid rgba(255,255,255,0.4)" : "1px solid var(--border)",
          background: onImage ? "rgba(255,255,255,0.08)" : "var(--card-bg)",
          color: onImage ? "#fff" : "var(--text-primary)",
          fontSize: compact ? 12 : 13,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: selectedValues.length === 0 ? 0.75 : 1,
          }}
        >
          {label}
        </span>
        <ChevronDownIcon color={onImage ? "#fff" : "var(--text-secondary)"} />
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
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
            zIndex: 9999,
            padding: 6,
          }}
        >
          <div
            onClick={handleClearClick}
            style={{
              padding: "8px 10px",
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {placeholder}
          </div>

          {options.map((opt) => {
            const selected = isSelected(opt);
            return (
              <div
                key={opt}
                onClick={() => handleOptionClick(opt)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
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
                {multi && (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                      background: selected ? "var(--accent)" : "transparent",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {selected && <CheckIcon />}
                  </span>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
