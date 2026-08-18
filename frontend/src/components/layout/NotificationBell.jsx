import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCreativesComErro, getMentionNotifications, markMentionRead } from "../../api/client.js";

const POLL_INTERVAL_MS = 60_000;

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function MentionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.28" />
    </svg>
  );
}

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Sino de notificacoes: mescla duas fontes -- criativos "Com erro" (status
// atribuido so manualmente, sem gatilho automatico -- ver statusSyncService)
// e mencoes em comentarios (@usuario) -- numa unica lista ordenada por data,
// mais recente primeiro, cada item com um icone diferenciando o tipo. Faz
// polling a cada 60s (primeiro uso desse padrao no projeto -- nao ha
// WebSocket/SSE aqui, entao e a forma mais simples de "quase tempo real"
// sem infraestrutura nova).
export default function NotificationBell({ variant = "onImage" }) {
  const [criativosComErro, setCriativosComErro] = useState([]);
  const [mencoes, setMencoes] = useState([]);
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const onImage = variant === "onImage";

  const open = pinned || hovering;

  useClickOutside(ref, () => setPinned(false));

  function carregar() {
    getCreativesComErro().then(setCriativosComErro).catch(() => {});
    getMentionNotifications().then(setMencoes).catch(() => {});
  }

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const mencoesNaoLidas = mencoes.filter((m) => !m.lido);
  const count = criativosComErro.length + mencoesNaoLidas.length;

  // Mescla as duas fontes num unico feed cronologico -- criativos com erro
  // nao tem timestamp proprio aqui (a lista e so "estado atual"), entao
  // aparecem sempre primeiro; mencoes ordenadas por data mais recente.
  const feed = [
    ...criativosComErro.map((c) => ({ tipo: "erro", key: `erro-${c.id}`, data: c })),
    ...mencoes.map((m) => ({ tipo: "mencao", key: `mencao-${m.mention_id}`, data: m })),
  ].sort((a, b) => {
    if (a.tipo === "erro" && b.tipo !== "erro") return -1;
    if (b.tipo === "erro" && a.tipo !== "erro") return 1;
    if (a.tipo === "mencao" && b.tipo === "mencao") return new Date(b.data.criado_em) - new Date(a.data.criado_em);
    return 0;
  });

  async function handleClickMencao(mencao) {
    setPinned(false);
    if (!mencao.lido) markMentionRead(mencao.mention_id).catch(() => {});
    setMencoes((prev) => prev.map((m) => (m.mention_id === mencao.mention_id ? { ...m, lido: true } : m)));
    if (mencao.campanha_id) {
      navigate(`/matriz-de-conteudo/${mencao.campanha_id}?criativo=${mencao.creative_id}`);
    }
  }

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
            width: 320,
            zIndex: 30,
          }}
        >
          <div
            style={{
              maxHeight: 360,
              overflowY: "auto",
              background: "var(--card-bg)",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
              padding: 12,
            }}
          >
            <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>Notificações</strong>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {feed.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                  Ainda não há notificações.
                </p>
              )}
              {feed.map((item) =>
                item.tipo === "erro" ? (
                  <div key={item.key} style={{ display: "flex", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                    <ErrorIcon />
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-primary)" }}>
                      O criativo <strong>{item.data.nome}</strong> ({item.data.campanha_nome_ref} · {item.data.veiculo}) está marcado como{" "}
                      <strong>Com erro</strong>.
                    </p>
                  </div>
                ) : (
                  <div
                    key={item.key}
                    onClick={() => handleClickMencao(item.data)}
                    style={{
                      display: "flex", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: 10, cursor: "pointer",
                      background: item.data.lido ? "transparent" : "var(--accent-soft)",
                    }}
                  >
                    <MentionIcon />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-primary)" }}>
                        <strong>{item.data.autor_nome}</strong> {item.data.eh_resposta ? "respondeu a você" : "mencionou você"} em <strong>{item.data.creative_nome}</strong>: "{item.data.trecho}
                        {item.data.trecho.length >= 80 ? "..." : ""}"
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 10.5, color: "var(--text-secondary)" }}>{formatDataHora(item.data.criado_em)}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
