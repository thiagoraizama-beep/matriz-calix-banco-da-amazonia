import { useEffect, useState } from "react";
import { getCampanhaActionLog } from "../../../api/client.js";
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

function AcaoBadge({ acao }) {
  const cor = ACAO_COR[acao] || { bg: "var(--border)", color: "var(--text-secondary)" };
  return (
    <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: cor.bg, color: cor.color, flexShrink: 0 }}>
      {ACAO_LABEL[acao] || acao}
    </span>
  );
}

export default function ActionLogModal({ campanhaId, onClose }) {
  const [acoes, setAcoes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCampanhaActionLog(campanhaId)
      .then(setAcoes)
      .catch(() => setError("Não foi possível carregar o histórico."));
  }, [campanhaId]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 640, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 16 }}>Histórico de ações</strong>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)" }}>×</button>
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

        {!error && !acoes && (
          <div style={{ padding: "30px 0" }}><Spinner /></div>
        )}

        {!error && acoes && acoes.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Nenhuma ação registrada ainda.</p>
        )}

        {!error && acoes && acoes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {acoes.map((a) => (
              <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <AcaoBadge acao={a.acao} />
                  <strong style={{ fontSize: 13 }}>{a.entidade_nome}</strong>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    {a.entidade_tipo === "campanha" ? "Campanha" : "Criativo"}
                  </span>
                </div>
                {(a.acao === "edicao" || a.acao === "status") && (
                  <p style={{ margin: "0 0 4px", fontSize: 12.5 }}>
                    <strong>{a.campo}:</strong>{" "}
                    {a.valor_anterior ? `${a.valor_anterior} → ` : ""}
                    {a.valor_novo || <span style={{ color: "var(--text-secondary)" }}>(vazio)</span>}
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
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
