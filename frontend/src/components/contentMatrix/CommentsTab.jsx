import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getMentionableUsers, getCreativeComments, postCreativeComment,
  updateCreativeComment, deleteCreativeComment, toggleCommentReaction,
} from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import Avatar from "../common/Avatar.jsx";

const EMOJIS_RAPIDOS = ["👍", "❤️", "😂", "🎉", "👀", "✅"];
const EMOJIS_COMPLETOS = [
  "👍", "👎", "❤️", "🔥", "😂", "😮", "😢", "😡", "🎉", "👀",
  "✅", "❌", "🙏", "💡", "⚠️", "🚀", "💯", "👏", "🤔", "😍",
  "😅", "🙌", "😎", "🥳", "😴", "🤝", "⭐", "📌", "❓", "❗",
];

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

// Agrupa reacoes (uma linha por usuario+emoji) em { emoji: [usuario_nome,...] }
// pra exibir contagem + tooltip com quem reagiu, sem duplicar o mesmo emoji.
function agruparReacoes(reacoes) {
  const grupos = {};
  for (const r of reacoes || []) {
    if (!grupos[r.emoji]) grupos[r.emoji] = [];
    grupos[r.emoji].push(r);
  }
  return grupos;
}

// Picker renderizado via portal direto no <body> -- os comentarios ficam
// dentro de um container com overflowY:auto (a lista rolavel), entao um
// dropdown posicionado com position:absolute normal seria cortado pela borda
// desse container. Calculamos a posicao em coordenadas de viewport (a partir
// do botao que abriu) e desenhamos com position:fixed fora da arvore do card.
function EmojiPicker({ anchorRect, emojis, expandivel, onExpandir, onEscolher, onFechar }) {
  const popRef = useRef(null);

  useEffect(() => {
    function handleClickFora(e) {
      if (popRef.current && !popRef.current.contains(e.target)) onFechar();
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [onFechar]);

  if (!anchorRect) return null;

  const largura = expandivel ? 220 : Math.min(emojis.length * 30 + 20, 260);
  let left = anchorRect.left;
  if (left + largura > window.innerWidth - 8) left = window.innerWidth - largura - 8;

  return createPortal(
    <div
      ref={popRef}
      style={{
        position: "fixed", top: anchorRect.bottom + 4, left, width: largura, zIndex: 1000,
        display: "flex", flexWrap: "wrap", gap: 4, padding: "8px", borderRadius: 8,
        maxHeight: expandivel ? 180 : undefined, overflowY: expandivel ? "auto" : undefined,
        background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(20,33,61,0.2)",
      }}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onEscolher(emoji)}
          style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 4 }}
        >
          {emoji}
        </button>
      ))}
      {!expandivel && onExpandir && (
        <button
          onClick={onExpandir}
          title="Mais emojis"
          style={{
            fontSize: 13, fontWeight: 700, background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: 6, cursor: "pointer", lineHeight: 1, padding: "4px 8px", color: "var(--text-secondary)",
          }}
        >
          +
        </button>
      )}
    </div>,
    document.body
  );
}

function ReactionBar({ comment, userId, onToggle }) {
  const [pickerModo, setPickerModo] = useState(null); // null | "rapido" | "completo"
  const [anchorRect, setAnchorRect] = useState(null);
  const botaoRef = useRef(null);
  const grupos = agruparReacoes(comment.reacoes);

  function abrirPicker(modo) {
    if (botaoRef.current) setAnchorRect(botaoRef.current.getBoundingClientRect());
    setPickerModo(modo);
  }

  function escolher(emoji) {
    onToggle(comment.id, emoji);
    setPickerModo(null);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 4 }}>
      {Object.entries(grupos).map(([emoji, lista]) => {
        const euReagi = lista.some((r) => r.usuario_id === userId);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(comment.id, emoji)}
            title={lista.map((r) => r.usuario_nome).join(", ")}
            style={{
              display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, padding: "2px 7px", borderRadius: 999,
              border: `1px solid ${euReagi ? "var(--accent)" : "var(--border)"}`,
              background: euReagi ? "var(--accent-soft)" : "transparent",
              cursor: "pointer",
            }}
          >
            <span>{emoji}</span>
            <span style={{ color: "var(--text-secondary)" }}>{lista.length}</span>
          </button>
        );
      })}

      <button
        ref={botaoRef}
        onClick={() => abrirPicker(pickerModo ? null : "rapido")}
        title="Reagir"
        style={{ fontSize: 12, padding: "2px 6px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
      >
        +
      </button>

      {pickerModo && (
        <EmojiPicker
          anchorRect={anchorRect}
          emojis={pickerModo === "completo" ? EMOJIS_COMPLETOS : EMOJIS_RAPIDOS}
          expandivel={pickerModo === "completo"}
          onExpandir={() => abrirPicker("completo")}
          onEscolher={escolher}
          onFechar={() => setPickerModo(null)}
        />
      )}
    </div>
  );
}

function CommentItem({ comment, isAutor, onEdit, onDelete, onReact, userId, onResponder, respondendoNomeDe, somenteLeitura }) {
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
    <div style={{ display: "flex", gap: 10 }}>
      <Avatar nome={comment.autor_nome} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: "var(--bg)", borderRadius: 12, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 12.5 }}>{comment.autor_nome}</strong>
              {respondendoNomeDe && (
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>respondendo a <strong>{respondendoNomeDe}</strong></span>
              )}
            </div>
            {!somenteLeitura && isAutor && !editando && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Editar
                </button>
                <button onClick={() => onDelete(comment.id)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Excluir
                </button>
              </div>
            )}
          </div>

          {editando ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", fontFamily: "inherit", fontSize: 12.5, resize: "vertical", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => { setEditando(false); setTexto(comment.texto); }} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", fontSize: 11.5, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.7 : 1 }}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{comment.texto}</p>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, paddingLeft: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {formatDataHora(comment.criado_em)}
            {comment.editado_em && <span style={{ fontStyle: "italic" }}> · editado</span>}
          </span>
          {!somenteLeitura && onResponder && (
            <button
              onClick={() => onResponder(comment)}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              Responder
            </button>
          )}
        </div>

        {!somenteLeitura && (
          <div style={{ paddingLeft: 4 }}>
            <ReactionBar comment={comment} userId={userId} onToggle={onReact} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentsTab({ creativeId, somenteLeitura = false }) {
  const { user } = useAuth();
  const [comments, setComments] = useState(null);
  const [mentionable, setMentionable] = useState([]);
  const [texto, setTexto] = useState("");
  const [mencionados, setMencionados] = useState([]); // [{ id, nome }]
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [sugestao, setSugestao] = useState(null); // { termo, inicio, opcoes }
  const [respondendoA, setRespondendoA] = useState(null); // comentario "pai" em resposta
  const textareaRef = useRef(null);

  function load() {
    getCreativeComments(creativeId).then(setComments).catch(() => setComments([]));
  }

  useEffect(() => {
    load();
    if (!somenteLeitura) getMentionableUsers(creativeId).then(setMentionable).catch(() => setMentionable([]));
  }, [creativeId, somenteLeitura]);

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

  function iniciarResposta(comment) {
    setRespondendoA(comment);
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
      await postCreativeComment(creativeId, { texto: texto.trim(), mencionadosIds: idsPresentes, parentId: respondendoA?.id || null });
      setTexto("");
      setMencionados([]);
      setRespondendoA(null);
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

  async function handleReact(commentId, emoji) {
    const reacoes = await toggleCommentReaction(commentId, emoji);
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, reacoes } : c)));
  }

  // Organiza em topo-level + respostas, achatando qualquer profundidade (resposta
  // de resposta) num unico nivel de indentacao sob o comentario raiz -- a UI so
  // suporta 1 nivel visual, mas o backend permite parent_id apontar pra qualquer
  // comentario. Sem achatar, uma resposta a uma resposta ficava "orfa": seu
  // parent_id apontava pra um comentario que nunca era iterado como raiz, entao
  // nunca aparecia na tela (o comentario existia no banco, so nao era renderizado).
  const porId = Object.fromEntries((comments || []).map((c) => [c.id, c]));
  function raizDe(c) {
    let atual = c;
    while (atual.parent_id && porId[atual.parent_id]) atual = porId[atual.parent_id];
    return atual.id;
  }

  const raiz = (comments || []).filter((c) => !c.parent_id);
  const respostasPorPai = {};
  for (const c of comments || []) {
    if (c.parent_id) {
      const raizId = raizDe(c);
      if (!respostasPorPai[raizId]) respostasPorPai[raizId] = [];
      respostasPorPai[raizId].push(c);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!comments ? (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Carregando comentários...</p>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhum comentário ainda. Seja o primeiro a comentar.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
          {raiz.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <CommentItem
                comment={c}
                isAutor={c.autor_id === user?.id}
                onEdit={handleEditComment}
                onDelete={setDeleting}
                onReact={handleReact}
                userId={user?.id}
                onResponder={iniciarResposta}
                somenteLeitura={somenteLeitura}
              />
              {(respostasPorPai[c.id] || []).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginLeft: 20, paddingLeft: 14, borderLeft: "2px solid var(--border)" }}>
                  {respostasPorPai[c.id].map((r) => (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      isAutor={r.autor_id === user?.id}
                      onEdit={handleEditComment}
                      onDelete={setDeleting}
                      onReact={handleReact}
                      userId={user?.id}
                      onResponder={iniciarResposta}
                      respondendoNomeDe={r.parent_id !== c.id ? porId[r.parent_id]?.autor_nome : null}
                      somenteLeitura={somenteLeitura}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!somenteLeitura && (
      <form onSubmit={handleEnviar} style={{ position: "relative", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        {respondendoA && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11.5, color: "var(--accent)", marginBottom: 8, padding: "6px 10px", background: "var(--accent-soft)", borderRadius: 8 }}>
            <span>Respondendo a <strong>{respondendoA.autor_nome}</strong></span>
            <button type="button" onClick={() => setRespondendoA(null)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={handleTextoChange}
          placeholder="Escreva um comentário... use @ para mencionar alguém"
          rows={2}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />

        {sugestao && sugestao.opcoes.length > 0 && (
          <div
            style={{
              position: "absolute", bottom: "100%", left: 0, marginBottom: 4, width: 220, maxHeight: 160, overflowY: "auto",
              background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10,
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

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            style={{
              padding: "8px 18px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: enviando || !texto.trim() ? "default" : "pointer",
              opacity: enviando || !texto.trim() ? 0.6 : 1,
            }}
          >
            {enviando ? "Enviando..." : respondendoA ? "Responder" : "Comentar"}
          </button>
        </div>
      </form>
      )}

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
