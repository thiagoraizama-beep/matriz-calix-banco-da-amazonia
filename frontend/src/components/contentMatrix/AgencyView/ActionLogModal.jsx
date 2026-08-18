import { useEffect, useState } from "react";
import { getCampanhaActionLog, getCampanhasActionLogGlobal } from "../../../api/client.js";
import Spinner from "../../common/Spinner.jsx";

const ACAO_LABEL = {
  criacao: "Criado",
  edicao: "Editado",
  status: "Status",
  exclusao: "Excluído",
};

const ACAO_COR = {
  criacao: { bg: "rgba(22,163,74,0.12)", color: "var(--success)" },
  edicao: { bg: "var(--accent-soft)", color: "var(--accent)" },
  status: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed" },
  exclusao: { bg: "rgba(220,38,38,0.12)", color: "var(--danger)" },
};

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CAMPOS_MONETARIOS = new Set(["Orçamento projetado"]);
// Datas ISO (2026-08-31, gravadas hoje) ou o formato bruto de Date.toString() do JS
// (ex: "Mon Aug 31 2026...", que ficou salvo em registros de historico anteriores
// a correcao do bug de gravacao) -- ambos viram DD/MM/AAAA aqui na exibicao.
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

function AcaoBadge({ acao }) {
  const cor = ACAO_COR[acao] || { bg: "var(--border)", color: "var(--text-secondary)" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: cor.bg, color: cor.color, flexShrink: 0 }}>
      {ACAO_LABEL[acao] || acao}
    </span>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function ActionLogModal({ campanhaId, global = false, onClose }) {
  const [acoes, setAcoes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const busca = global ? getCampanhasActionLogGlobal() : getCampanhaActionLog(campanhaId);
    busca.then(setAcoes).catch(() => setError("Não foi possível carregar o histórico."));
  }, [campanhaId, global]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(10,16,32,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 16, fontWeight: 700 }}>Histórico de ações</strong>
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

          {!error && !acoes && (
            <div style={{ padding: "30px 0" }}><Spinner /></div>
          )}

          {!error && acoes && acoes.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Nenhuma ação registrada ainda.</p>
          )}

          {!error && acoes && acoes.length > 0 && acoes.map((a) => (
            <div key={a.id} style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                <AcaoBadge acao={a.acao} />
                <strong style={{ fontSize: 13 }}>{a.entidade_nome}</strong>
                <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                  {a.entidade_tipo === "campanha" ? "Campanha" : "Criativo"}
                </span>
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
