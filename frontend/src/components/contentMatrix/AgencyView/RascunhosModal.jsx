import { useEffect, useState } from "react";
import { getMeusRascunhos, deleteMatrixCreative } from "../../../api/client.js";
import Spinner from "../../common/Spinner.jsx";
import ConfirmDialog from "../../common/ConfirmDialog.jsx";
import CreativeFormModal from "./CreativeFormModal.jsx";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Lista os rascunhos do proprio usuario (privados, escopados por autoria no
// backend) -- permite retomar a edicao (abre CreativeFormModal reaproveitando
// o mesmo formulario de sempre) ou descartar de vez, o que exclui o registro
// do banco e a midia do Cloudinary (mesma rota de exclusao normal).
export default function RascunhosModal({ onClose }) {
  const [rascunhos, setRascunhos] = useState(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);
  const [descartando, setDescartando] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  function load() {
    getMeusRascunhos().then(setRascunhos).catch(() => setError("Não foi possível carregar seus rascunhos."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConfirmarDescarte() {
    setExcluindo(true);
    try {
      await deleteMatrixCreative(descartando.id);
      setDescartando(null);
      load();
    } catch {
      setError("Não foi possível excluir este rascunho.");
    } finally {
      setExcluindo(false);
    }
  }

  if (editando) {
    return (
      <CreativeFormModal
        creative={editando}
        onClose={() => setEditando(null)}
        onSaved={() => { setEditando(null); load(); }}
      />
    );
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(10,16,32,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 16, fontWeight: 700 }}>Meus rascunhos</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

          {!error && !rascunhos && (
            <div style={{ padding: "30px 0" }}><Spinner /></div>
          )}

          {!error && rascunhos && rascunhos.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "36px 0", color: "var(--text-secondary)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <p style={{ fontSize: 13, margin: 0 }}>Nenhum rascunho salvo no momento.</p>
            </div>
          )}

          {!error && rascunhos && rascunhos.length > 0 && rascunhos.map((r) => (
            <div
              key={r.id}
              style={{
                background: "var(--bg)", borderRadius: 14, padding: 14,
                display: "flex", alignItems: "center", gap: 14,
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--card-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {r.cloudinary_url ? (
                  r.tipo_midia === "video" ? (
                    <video src={r.cloudinary_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <img src={r.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.6">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 15l5-5 4 4 5-5 4 4" />
                  </svg>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13.5, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.nome || <span style={{ color: "var(--text-secondary)", fontWeight: 400, fontStyle: "italic" }}>Sem nome ainda</span>}
                </strong>
                <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.campanha || "Sem campanha"}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "var(--text-secondary)" }}>
                  Editado em {formatDataHora(r.atualizado_em)}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setEditando(r)}
                  style={{ padding: "7px 14px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Continuar
                </button>
                <button
                  onClick={() => setDescartando(r)}
                  style={{ padding: "7px 14px", borderRadius: 999, border: "none", background: "transparent", color: "var(--danger)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {descartando && (
        <ConfirmDialog
          title="Descartar rascunho"
          message={`Tem certeza que deseja excluir o rascunho "${descartando.nome || "sem nome"}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Descartar"
          onConfirm={handleConfirmarDescarte}
          onCancel={() => setDescartando(null)}
          confirming={excluindo}
        />
      )}
    </div>
  );
}
