import { useEffect, useRef, useState } from "react";

// Mesma mecanica de busca/autocomplete do SearchSelect (digite pra filtrar,
// clique pra escolher), mas permite VARIOS valores selecionados ao mesmo
// tempo -- cada um vira um chip removivel acima do campo de busca. Criado
// pra listas longas onde pills soltas (uma por opcao) ficam impossiveis de
// escanear visualmente (ex: Formato do criativo, ~50 opcoes).
export default function MultiSearchSelect({ options, value, onChange, placeholder }) {
  const selecionados = value || [];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

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
      setMenuRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
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

  const filtered = options
    .filter((o) => !selecionados.includes(o))
    .filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50);

  function adicionar(opcao) {
    if (!selecionados.includes(opcao)) onChange([...selecionados, opcao]);
    setQuery("");
    updateMenuPosition();
    inputRef.current?.focus();
  }

  function remover(opcao) {
    onChange(selecionados.filter((v) => v !== opcao));
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {selecionados.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selecionados.map((v) => (
            <span
              key={v}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 12px", borderRadius: 999,
                background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600,
              }}
            >
              {v}
              <button
                type="button"
                onClick={() => remover(v)}
                aria-label={`Remover ${v}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          updateMenuPosition();
          setOpen(true);
        }}
        onFocus={() => {
          updateMenuPosition();
          setOpen(true);
        }}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          fontSize: 13,
          boxSizing: "border-box",
        }}
      />
      {open && menuRect && filtered.length > 0 && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            maxHeight: 220,
            overflowY: "auto",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
            zIndex: 9999,
          }}
        >
          {filtered.map((o) => (
            <div
              key={o}
              onMouseDown={(e) => { e.preventDefault(); adicionar(o); }}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
