import { useEffect, useRef, useState } from "react";
import { getCreativesComErro } from "../../api/client.js";

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

export default function NotificationBell({ variant = "onImage" }) {
  const [criativosComErro, setCriativosComErro] = useState([]);
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  const onImage = variant === "onImage";

  const open = pinned || hovering;

  useClickOutside(ref, () => setPinned(false));

  useEffect(() => {
    getCreativesComErro().then(setCriativosComErro).catch(console.error);
  }, []);

  const count = criativosComErro.length;

  return (
    <div
      ref={ref}
      style={{ position: "relative" }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        onClick={() => setPinned((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: onImage ? "1px solid rgba(255,255,255,0.4)" : "1px solid var(--border)",
          background: onImage ? "rgba(255,255,255,0.08)" : "var(--card-bg)",
          color: onImage ? "#fff" : "var(--text-primary)",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--danger)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            paddingTop: 8,
            width: 300,
            zIndex: 30,
          }}
        >
          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
              background: "var(--card-bg)",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
              padding: 12,
            }}
          >
            <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>Notificações</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {count === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                  Ainda não há notificações.
                </p>
              )}
              {criativosComErro.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-primary)" }}>
                    O criativo <strong>{c.nome}</strong> ({c.campanha_nome_ref} · {c.veiculo}) está marcado como{" "}
                    <strong>Com erro</strong>.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
