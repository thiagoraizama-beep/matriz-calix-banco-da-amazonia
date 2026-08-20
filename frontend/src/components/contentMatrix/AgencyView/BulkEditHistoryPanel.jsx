import { useEffect, useState } from "react";
import { getBulkEditOperations, undoBulkEditOperation, undoBulkEditItem } from "../../../api/client.js";
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CAMPOS_MONETARIOS = new Set(["orcamentoProjetado"]);
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}(T|$)/;
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

// Painel lateral com as edicoes em massa/individuais do usuario logado ainda
// dentro da janela de 2h e nao desfeitas -- cada operacao lista os criativos
// afetados individualmente, cada um com seu proprio "Desfazer" (reverte so
// aquele item, mantendo os demais do lote como estao) alem de um "Desfazer
// tudo" no topo do card (reverte os que ainda estiverem pendentes).
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
    const alvo = confirmando;
    setConfirmando(null);
    setDesfazendo(alvo.chave);
    try {
      if (alvo.tipo === "operacao") await undoBulkEditOperation(alvo.id);
      else await undoBulkEditItem(alvo.id);
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
          width: 420, maxWidth: "100%", height: "100%", overflowY: "auto", display: "flex", flexDirection: "column",
          background: "var(--card-bg)", boxShadow: "-12px 0 40px rgba(10,16,32,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 20px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div>
            <strong style={{ fontSize: 16, fontWeight: 700 }}>Últimas edições</strong>
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

        <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

          {!error && !operacoes && (
            <div style={{ padding: "30px 0" }}><Spinner /></div>
          )}

          {!error && operacoes && operacoes.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              Nenhuma edição desfazível no momento.
            </p>
          )}

          {!error && operacoes && operacoes.map((op) => {
            const tempoRestante = formatTempoRestante(op.expira_em);
            if (!tempoRestante) return null;
            const pendentes = op.itens.filter((i) => !i.desfeito);
            const opDesfazendo = desfazendo === `op-${op.id}`;
            return (
              <div key={op.id} style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>
                      {op.total_criativos} criativo{op.total_criativos !== 1 ? "s" : ""}
                    </strong>
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
                      {op.campos_alterados.map((c) => LABEL_CAMPO[c] || c).join(", ")}
                    </p>
                  </div>
                  {pendentes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setConfirmando({ tipo: "operacao", id: op.id, chave: `op-${op.id}`, total: pendentes.length, campos: op.campos_alterados })}
                      disabled={opDesfazendo}
                      title="Desfazer todos os criativos pendentes desta edição"
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999,
                        border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)",
                        fontSize: 11, fontWeight: 700, cursor: opDesfazendo ? "default" : "pointer",
                        opacity: opDesfazendo ? 0.6 : 1, whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      <UndoIcon />
                      {opDesfazendo ? "..." : "Desfazer tudo"}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {op.itens.map((item) => {
                    const itemDesfazendo = desfazendo === `item-${item.snapshotId}`;
                    return (
                      <div
                        key={item.snapshotId}
                        style={{
                          background: "var(--card-bg)", borderRadius: 8, padding: "8px 10px",
                          display: "flex", flexDirection: "column", gap: 4,
                          opacity: item.desfeito ? 0.55 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <strong style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.nome}
                          </strong>
                          {item.desfeito ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "var(--success)", flexShrink: 0 }}>
                              <CheckIcon /> Desfeito
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmando({ tipo: "item", id: item.snapshotId, chave: `item-${item.snapshotId}`, nome: item.nome, campos: item.campos.map((c) => c.campo) })}
                              disabled={itemDesfazendo}
                              style={{
                                display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 999,
                                border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)",
                                fontSize: 10.5, fontWeight: 700, cursor: itemDesfazendo ? "default" : "pointer",
                                opacity: itemDesfazendo ? 0.6 : 1, flexShrink: 0,
                              }}
                            >
                              <UndoIcon />
                              {itemDesfazendo ? "..." : "Desfazer"}
                            </button>
                          )}
                        </div>
                        {item.campos.map((c) => (
                          <div key={c.campo} style={{ fontSize: 11 }}>
                            <span style={{ color: "var(--text-secondary)" }}>{LABEL_CAMPO[c.campo] || c.campo}: </span>
                            <span style={{ color: "var(--text-secondary)", textDecoration: "line-through" }}>{formatValor(c.valorAntes, c.campo)}</span>
                            {" → "}
                            <span>{formatValor(c.valorDepois, c.campo)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>
                  {formatDataHora(op.criado_em)} · expira em {tempoRestante}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {confirmando && (
        <ConfirmDialog
          title={confirmando.tipo === "operacao" ? "Desfazer todos os criativos" : "Desfazer este criativo"}
          message={
            confirmando.tipo === "operacao"
              ? `Tem certeza que deseja reverter ${confirmando.total} criativo(s) ainda pendentes? Os campos alterados (${confirmando.campos.map((c) => LABEL_CAMPO[c] || c).join(", ")}) voltarão ao valor anterior.`
              : `Tem certeza que deseja reverter "${confirmando.nome}"? Os campos alterados (${confirmando.campos.map((c) => LABEL_CAMPO[c] || c).join(", ")}) voltarão ao valor anterior. Os demais criativos deste lote não serão afetados.`
          }
          confirmLabel="Desfazer"
          onConfirm={handleConfirmarDesfazer}
          onCancel={() => setConfirmando(null)}
        />
      )}
    </div>
  );
}
