import { useEffect, useMemo, useState } from "react";
import {
  getCampanhaActionLog, getCampanhasActionLogGlobal,
  getLixeiraHistorico, getUsuariosHistorico,
} from "../../../api/client.js";
import Spinner from "../../common/Spinner.jsx";

// Badge composta "Entidade + acao" (ex: "Campanha excluída", "Criativo
// criado") em vez de so a acao crua ("Excluído") -- sozinha ela nao dizia o
// que foi excluido/criado/editado, so dava pra saber olhando o nome da
// entidade ao lado. Concordancia de genero: campanha/entidade de usuario sao
// femininas ("excluída"), criativo e masculino ("excluído").
const GENERO_ENTIDADE = { campanha: "f", criativo: "m", usuario: "m" };

const ACAO_PARTICIPIO = {
  criacao: { m: "criado", f: "criada" },
  edicao: { m: "editado", f: "editada" },
  status: { m: "com status alterado", f: "com status alterado" },
  exclusao: { m: "excluído", f: "excluída" },
  restauracao: { m: "restaurado", f: "restaurada" },
  exclusao_definitiva: { m: "excluído definitivamente", f: "excluída definitivamente" },
};

// promocao_admin/revogacao_admin nao seguem o padrao "Entidade + particípio"
// (nao fazem sentido como "Usuário promovido") -- tem frase propria.
const ACAO_LABEL_CUSTOM = {
  promocao_admin: "Promovido a administrador",
  revogacao_admin: "Administrador removido",
};

const ENTIDADE_LABEL = { campanha: "Campanha", criativo: "Criativo", usuario: "Usuário" };

function descricaoAcao(acao, entidadeTipo) {
  if (ACAO_LABEL_CUSTOM[acao]) return ACAO_LABEL_CUSTOM[acao];
  const genero = GENERO_ENTIDADE[entidadeTipo] || "m";
  const participio = ACAO_PARTICIPIO[acao]?.[genero] || acao;
  return `${ENTIDADE_LABEL[entidadeTipo] || entidadeTipo} ${participio}`;
}

// Acoes comuns usam o mesmo esquema de sempre (var(--danger) pra exclusao,
// var(--accent) pra edicao); acoes admin-only (lixeira/usuarios) usam so a
// paleta institucional verde/terrosa, nunca vermelho/laranja/roxo, pra ficarem
// visualmente distintas do historico "normal" que qualquer agencia ja via.
const ACAO_COR = {
  criacao: { bg: "rgba(22,163,74,0.12)", color: "var(--success)" },
  edicao: { bg: "var(--accent-soft)", color: "var(--accent)" },
  status: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed" },
  exclusao: { bg: "rgba(220,38,38,0.12)", color: "var(--danger)" },
  restauracao: { bg: "rgba(30,156,107,0.14)", color: "#1E9C6B" },
  exclusao_definitiva: { bg: "rgba(0,61,42,0.12)", color: "#003D2A" },
};

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CAMPOS_MONETARIOS = new Set(["Orçamento projetado"]);
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_DATA_JS_TOSTRING = /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}/;

function formatValorCampo(valor, campo) {
  if (!valor) return valor;
  if (CAMPOS_MONETARIOS.has(campo)) {
    const num = Number(String(valor).replace(",", "."));
    if (!Number.isNaN(num)) return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (REGEX_DATA_ISO.test(valor) || REGEX_DATA_JS_TOSTRING.test(valor)) {
    const d = new Date(valor);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return valor;
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function AcaoBadge({ acao, entidadeTipo }) {
  const cor = ACAO_COR[acao] || { bg: "var(--border)", color: "var(--text-secondary)" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: cor.bg, color: cor.color, flexShrink: 0 }}>
      {descricaoAcao(acao, entidadeTipo)}
    </span>
  );
}

// Painel lateral (drawer), acionado por um icone discreto no lugar do antigo
// botao-pill "Historico". Consolida numa unica lista buscavel: o historico
// "normal" (criacao/edicao/status/exclusao de criativos e campanhas -- por
// campanha especifica ou global, dependendo de onde foi aberto) que qualquer
// agencia ja via antes, e, so para administradores (isAdmin), tambem as acoes
// da Lixeira (restaurar/excluir definitivo) e de gestao de usuarios
// (criacao/exclusao de conta) -- ambas admin-only no backend.
export default function HistoricoDrawer({ campanhaId, global = false, isAdmin, onClose }) {
  const [acoes, setAcoes] = useState(null);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const buscas = [global ? getCampanhasActionLogGlobal() : getCampanhaActionLog(campanhaId)];
    // Lixeira/usuarios sao globais por natureza (nao fazem sentido "por
    // campanha") -- so entram na lista quando o admin abre o historico geral,
    // nao quando esta dentro de uma campanha especifica, pra nao confundir
    // "o que aconteceu nesta campanha" com "o que um admin fez no sistema".
    if (isAdmin && !campanhaId) {
      buscas.push(getLixeiraHistorico(), getUsuariosHistorico());
    }
    Promise.all(buscas)
      .then((listas) => {
        const combinado = listas.flat().sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
        setAcoes(combinado);
      })
      .catch(() => setError("Não foi possível carregar o histórico."));
  }, [campanhaId, global, isAdmin]);

  const filtradas = useMemo(() => {
    if (!acoes) return null;
    const termo = busca.trim().toLowerCase();
    if (!termo) return acoes;
    return acoes.filter((a) =>
      a.entidade_nome?.toLowerCase().includes(termo) ||
      a.campo?.toLowerCase().includes(termo) ||
      a.alterado_por_nome?.toLowerCase().includes(termo) ||
      ACAO_LABEL[a.acao]?.toLowerCase().includes(termo)
    );
  }, [acoes, busca]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400, maxWidth: "100%", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column",
          background: "var(--card-bg)", boxShadow: "-12px 0 40px rgba(10,16,32,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <strong style={{ fontSize: 16, fontWeight: 700 }}>Histórico</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "var(--bg)",
              border: "1px solid var(--border)", borderRadius: 999, padding: "8px 14px",
            }}
          >
            <span style={{ color: "var(--text-secondary)", display: "flex" }}><SearchIcon /></span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, campo ou pessoa..."
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--text-primary)", width: "100%" }}
            />
          </div>
        </div>

        <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

          {!error && !acoes && (
            <div style={{ padding: "30px 0" }}><Spinner /></div>
          )}

          {!error && filtradas && filtradas.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              {busca ? "Nenhum resultado para essa busca." : "Nenhuma ação registrada ainda."}
            </p>
          )}

          {!error && filtradas && filtradas.map((a) => (
            <div key={`${a.entidade_tipo}-${a.id}`} style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                <AcaoBadge acao={a.acao} entidadeTipo={a.entidade_tipo} />
                <strong style={{ fontSize: 13 }}>{a.entidade_nome}</strong>
              </div>
              {(a.acao === "edicao" || a.acao === "status") && (
                <p style={{ margin: "0 0 5px", fontSize: 12.5 }}>
                  <strong>{a.campo}:</strong>{" "}
                  {a.valor_anterior ? `${formatValorCampo(a.valor_anterior, a.campo)} → ` : ""}
                  {formatValorCampo(a.valor_novo, a.campo) || <span style={{ color: "var(--text-secondary)" }}>(vazio)</span>}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)" }}>
                {a.origem === "automatico" ? "Sistema (automático)" : a.alterado_por_nome || "Usuário removido"}
                {" · "}
                {formatDataHora(a.criado_em)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
