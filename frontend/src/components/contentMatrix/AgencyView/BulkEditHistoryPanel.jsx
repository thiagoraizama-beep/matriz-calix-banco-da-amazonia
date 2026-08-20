import { useEffect, useState } from "react";
import { getBulkEditOperations, undoBulkEditOperation } from "../../../api/client.js";
import Spinner from "../../common/Spinner.jsx";
import ConfirmDialog from "../../common/ConfirmDialog.jsx";

// Rotulos legiveis dos campos que podem ter sido alterados numa edicao em
// massa -- mesma chave usada em CAMPOS_EDICAO_EM_MASSA (backend), so os
// nomes exibidos na UI diferem.
const LABEL_CAMPO = {
  status: "Status",
  campanha: "Campanha", campanhaVeiculoId: "Campanha/Veículo", veiculo: "Veículo",
  plataforma: "Plataforma", tiposCompra: "Tipo de compra", campaignName: "Campaign Name",
  conjunto: "Ad Group", formato: "Formato", posicionamento: "Posicionamento",
  periodoInicio: "Início do período", periodoFim: "Fim do período", urlDestino: "URL de destino",
  impulsionado: "Tipo de publicação", segmentacao: "Segmentação", titulo: "Título",
  descricao: "Descrição", observacoes: "Observações", ehPerformance: "Performance",
  orcamentoProjetado: "Orçamento projetado",
};

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CAMPOS_MONETARIOS = new Set(["orcamentoProjetado"]);
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_DATA_JS_TOSTRING = /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}/;

function formatValor(valor, campo) {
  if (valor === null || valor === undefined || valor === "") return "(vazio)";
  if (campo === "impulsionado") return valor === true || valor === "true" ? "Impulsionado" : "Dark Post";
  if (campo === "ehPerformance") return valor === true || valor === "true" ? "Sim" : "Não";
  if (Array.isArray(valor)) return valor.join(", ") || "(vazio)";
  if (CAMPOS_MONETARIOS.has(campo)) {
    const num = Number(String(valor).replace(",", "."));
    if (!Number.isNaN(num)) return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  const str = String(valor);
  if (REGEX_DATA_ISO.test(str) || REGEX_DATA_JS_TOSTRING.test(str)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return str;
}

// "1h 48min", "12min", "menos de 1min" -- so a granularidade que importa
// numa janela de no maximo 2h, sem exagerar em precisao (segundos).
function formatTempoRestante(expiraEmIso) {
  const ms = new Date(expiraEmIso).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0 && min === 0) return "menos de 1min";
  if (h === 0) return `${min}min`;
  return `${h}h ${min}min`;
}

// Painel lateral com as edicoes em massa do usuario logado ainda dentro da
// janela de 2h e nao desfeitas -- cada uma pode ser revertida daqui, cobrindo
// o caso de perceber o erro depois (nao so na hora, que ja tem o botao
// "Desfazer agora" inline no proprio BulkEditModal).
export default function BulkEditHistoryPanel({ onClose, onUndone }) {
  const [operacoes, setOperacoes] = useState(null);
  const [error, setError] = useState("");
  const [desfazendo, setDesfazendo] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  // Forca recalculo do tempo restante a cada minuto, sem precisar recarregar
  // a lista inteira do servidor.
  const [, setTick] = useState(0);

  function load() {
    getBulkEditOperations()
      .then(setOperacoes)
      .catch(() => setError("Não foi possível carregar as últimas edições."));
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleConfirmarDesfazer() {
    const op = confirmando;
    setConfirmando(null);
    setDesfazendo(op.id);
    try {
      await undoBulkEditOperation(op.id);
      load();
      onUndone?.();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível desfazer esta edição.");
    } finally {
      setDesfazendo(null);
    }
  }

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div>
            <strong style={{ fontSize: 16, fontWeight: 700 }}>Últimas edições em massa</strong>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              Você pode desfazer até 2h após aplicar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0 }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

          {!error && !operacoes && (
            <div style={{ padding: "30px 0" }}><Spinner /></div>
          )}

          {!error && operacoes && operacoes.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              Nenhuma edição em massa desfazível no momento.
            </p>
          )}

          {!error && operacoes && operacoes.map((op) => {
            const tempoRestante = formatTempoRestante(op.expira_em);
            if (!tempoRestante) return null;
            return (
              <div key={op.id} style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>
                    {op.total_criativos} criativo{op.total_criativos !== 1 ? "s" : ""}
                  </strong>
                  {op.nomesCriativos?.length > 0 && (
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {op.nomesCriativos.join(", ")}
                    </p>
                  )}
                </div>

                {op.detalhamento?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--card-bg)", borderRadius: 8, padding: "8px 10px" }}>
                    {op.detalhamento.map((d) => (
                      <div key={d.campo} style={{ fontSize: 11.5 }}>
                        <strong>{LABEL_CAMPO[d.campo] || d.campo}:</strong>{" "}
                        <span style={{ color: "var(--text-secondary)", textDecoration: "line-through" }}>{formatValor(d.valorAntes, d.campo)}</span>
                        {" → "}
                        <span>{formatValor(d.valorDepois, d.campo)}</span>
                      </div>
                    ))}
                    {op.total_criativos > 1 && (
                      <span style={{ fontSize: 10.5, color: "var(--text-secondary)", fontStyle: "italic" }}>
                        Valores do primeiro criativo — os demais podem ter tido valores anteriores diferentes.
                      </span>
                    )}
                  </div>
                )}

                <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>
                  {formatDataHora(op.criado_em)} · expira em {tempoRestante}
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmando(op)}
                  disabled={desfazendo === op.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0",
                    borderRadius: 999, border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)",
                    fontSize: 12.5, fontWeight: 700, cursor: desfazendo === op.id ? "default" : "pointer",
                    opacity: desfazendo === op.id ? 0.6 : 1,
                  }}
                >
                  <UndoIcon />
                  {desfazendo === op.id ? "Desfazendo..." : "Desfazer"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {confirmando && (
        <ConfirmDialog
          title="Desfazer edição em massa"
          message={`Tem certeza que deseja reverter a edição de ${confirmando.total_criativos} criativo(s)? Os campos alterados (${confirmando.campos_alterados.map((c) => LABEL_CAMPO[c] || c).join(", ")}) voltarão ao valor anterior.`}
          confirmLabel="Desfazer"
          onConfirm={handleConfirmarDesfazer}
          onCancel={() => setConfirmando(null)}
        />
      )}
    </div>
  );
}
