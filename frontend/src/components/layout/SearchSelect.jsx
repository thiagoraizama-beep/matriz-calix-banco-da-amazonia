import { useEffect, useRef, useState } from "react";

// Campo de busca com autocomplete: digite para filtrar e ver sugestoes, clique
// numa opcao para completar rapido. Se o texto digitado nao bater com nenhuma
// opcao cadastrada, o valor digitado e aceito do mesmo jeito (o campo nunca
// bloqueia digitacao livre, so ajuda a encontrar valores ja existentes).
// Usa position: fixed calculado via JS para não ser cortado por containers com overflow.
export default function SearchSelect({ options, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

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

  // Mantem o menu colado no input enquanto a pagina rola ou a janela muda de tamanho.
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

  const filtered = query && !showAll
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())).slice(0, 50)
    : options.slice(0, 50);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setShowAll(false);
          updateMenuPosition();
          setOpen(true);
        }}
        onFocus={() => {
          setShowAll(true);
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
              onClick={() => {
                onChange(o);
                setQuery(o);
                setShowAll(false);
                setOpen(false);
              }}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
              onMouseDown={(e) => e.preventDefault()}
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
