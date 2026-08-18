import { useEffect, useRef, useState } from "react";
import {
  getMentionableUsers, getCreativeComments, postCreativeComment,
  updateCreativeComment, deleteCreativeComment,
} from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Detecta se o usuario esta digitando uma mencao (@ seguido de texto sem
// espaco, ate o cursor) -- usado tanto pra abrir o dropdown de sugestoes
// quanto pra saber o que substituir ao escolher um usuario.
function detectarMencaoEmAndamento(texto, cursorPos) {
  const ateOCursor = texto.slice(0, cursorPos);
  const match = ateOCursor.match(/@([^\s@]*)$/);
  if (!match) return null;
  return { termo: match[1].toLowerCase(), inicio: match.index };
}

function CommentItem({ comment, isAutor, onEdit, onDelete }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(comment.texto);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await onEdit(comment.id, texto.trim());
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <strong style={{ fontSize: 12.5 }}>{comment.autor_nome}</strong>
        {isAutor && !editando && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer", padding: 0 }}>
              Editar
            </button>
            <button onClick={() => onDelete(comment.id)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11, cursor: "pointer", padding: 0 }}>
              Excluir
            </button>
          </div>
        )}
      </div>

      {editando ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 12.5, resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => { setEditando(false); setTexto(comment.texto); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", fontSize: 11.5, cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 11.5, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.7 : 1 }}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{comment.texto}</p>
      )}

      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
        {formatDataHora(comment.criado_em)}
        {comment.editado_em && <span style={{ fontStyle: "italic" }}> · (editado)</span>}
      </p>
    </div>
  );
}

export default function CommentsTab({ creativeId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState(null);
  const [mentionable, setMentionable] = useState([]);
  const [texto, setTexto] = useState("");
  const [mencionados, setMencionados] = useState([]); // [{ id, nome }]
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [sugestao, setSugestao] = useState(null); // { termo, inicio, opcoes }
  const textareaRef = useRef(null);

  function load() {
    getCreativeComments(creativeId).then(setComments).catch(() => setComments([]));
  }

  useEffect(() => {
    load();
    getMentionableUsers(creativeId).then(setMentionable).catch(() => setMentionable([]));
  }, [creativeId]);

  function handleTextoChange(e) {
    const novoTexto = e.target.value;
    setTexto(novoTexto);

    const mencao = detectarMencaoEmAndamento(novoTexto, e.target.selectionStart);
    if (!mencao) { setSugestao(null); return; }
    const opcoes = mentionable.filter((u) => u.nome.toLowerCase().includes(mencao.termo));
    setSugestao({ ...mencao, opcoes });
  }

  function escolherMencao(usuario) {
    if (!sugestao) return;
    const antes = texto.slice(0, sugestao.inicio);
    const depois = texto.slice(sugestao.inicio + 1 + sugestao.termo.length);
    const novoTexto = `${antes}@${usuario.nome} ${depois}`;
    setTexto(novoTexto);
    setMencionados((prev) => (prev.some((m) => m.id === usuario.id) ? prev : [...prev, usuario]));
    setSugestao(null);
    textareaRef.current?.focus();
  }

  async function handleEnviar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setError("");
    try {
      // So envia como mencionado quem realmente ainda aparece no texto (o
      // usuario pode ter apagado o "@Nome" depois de escolher na sugestao).
      const idsPresentes = mencionados.filter((m) => texto.includes(`@${m.nome}`)).map((m) => m.id);
      await postCreativeComment(creativeId, { texto: texto.trim(), mencionadosIds: idsPresentes });
      setTexto("");
      setMencionados([]);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível enviar o comentário.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleEditComment(commentId, novoTexto) {
    await updateCreativeComment(commentId, novoTexto);
    load();
  }

  async function handleConfirmDelete() {
    await deleteCreativeComment(deleting);
    setDeleting(null);
    load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!comments ? (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Carregando comentários...</p>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhum comentário ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isAutor={c.autor_id === user?.id}
              onEdit={handleEditComment}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleEnviar} style={{ position: "relative" }}>
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={handleTextoChange}
          placeholder="Escreva um comentário... use @ para mencionar alguém"
          rows={2}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />

        {sugestao && sugestao.opcoes.length > 0 && (
          <div
            style={{
              position: "absolute", bottom: "100%", left: 0, marginBottom: 4, width: 220, maxHeight: 160, overflowY: "auto",
              background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8,
              boxShadow: "0 8px 24px rgba(20,33,61,0.15)", zIndex: 10,
            }}
          >
            {sugestao.opcoes.map((u) => (
              <div
                key={u.id}
                onClick={() => escolherMencao(u)}
                style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {u.nome}
              </div>
            ))}
          </div>
        )}

        {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: "6px 0 0" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: enviando || !texto.trim() ? "default" : "pointer",
              opacity: enviando || !texto.trim() ? 0.6 : 1,
            }}
          >
            {enviando ? "Enviando..." : "Comentar"}
          </button>
        </div>
      </form>

      {deleting && (
        <ConfirmDialog
          title="Excluir comentário"
          message="Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita."
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
