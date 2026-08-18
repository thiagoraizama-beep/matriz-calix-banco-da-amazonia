import { useEffect, useState } from "react";
import StatusBadge from "./statusBadge.jsx";
import CreativeEvolutionChart from "../creative/CreativeEvolutionChart.jsx";
import Spinner from "../common/Spinner.jsx";
import CommentsTab from "./CommentsTab.jsx";
import { getCreativeByAdName } from "../../api/client.js";

const EMPTY_FILTERS = {};

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
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

function formatPeriodo(inicio, fim) {
  if (!inicio && !fim) return null;
  const fmt = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
  if (inicio && fim) return `${fmt(inicio)} - ${fmt(fim)}`;
  return fmt(inicio || fim);
}

function formatCompact(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("pt-BR");
}

function Section({ title, children }) {
  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)" }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 500, wordBreak: "break-word" }}>
        {value || <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>—</span>}
      </p>
    </div>
  );
}

function KpiCard({ bg, color, value, label }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
      <strong style={{ fontSize: 19, color, lineHeight: 1.1 }}>{value}</strong>
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</p>
    </div>
  );
}

const TABS = [
  { id: "implementacao", label: "Implementação" },
  { id: "performance", label: "Performance" },
  { id: "comentarios", label: "Comentários" },
];

// Modal unico de detalhe, dividido em 3 abas: "Implementacao" (cadastro, sempre
// instantaneo, vem do proprio objeto creative), "Performance" (metricas completas
// -- Investimento/Impressoes/Cliques/CTR + Sessoes/Leads do GA4 + grafico -- buscada
// sob demanda so quando essa aba e aberta pela primeira vez, casando pelo Ad Name)
// e "Comentarios" (com @mencao, ver CommentsTab.jsx). abaInicial permite abrir
// o modal ja na aba certa (ex: clicar numa notificacao de mencao no sino).
export default function CreativeFusedDetailModal({ creative, campanhaId, onClose, abaInicial = "implementacao" }) {
  const periodo = formatPeriodo(creative.periodo_inicio, creative.periodo_fim);
  const [copied, setCopied] = useState(false);
  const [aba, setAba] = useState(abaInicial);

  // Seção de Performance so e ocultada por completo quando o vinculo nao tem a
  // permissao (acesso_analise_criativo) -- sem ad_name ou sem match ainda, a aba
  // continua visivel com uma mensagem explicando o motivo, em vez de sumir sem aviso.
  const temPermissaoAnalise = creative.acesso_analise_criativo === true;
  const temAdName = Boolean(creative.ad_name);
  const [performance, setPerformance] = useState(undefined); // undefined=nao carregado ainda, null=sem dado

  useEffect(() => {
    if (aba !== "performance" || !temPermissaoAnalise || !temAdName || performance !== undefined) return;
    getCreativeByAdName(campanhaId, creative.plataforma, creative.ad_name, EMPTY_FILTERS)
      .then(setPerformance)
      .catch(() => setPerformance(null));
  }, [aba, campanhaId, creative.plataforma, creative.ad_name, temPermissaoAnalise, temAdName, performance]);

  function handleCopyUrl() {
    if (!creative.url_destino) return;
    navigator.clipboard.writeText(creative.url_destino);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1040, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto",
          display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(10,16,32,0.35)",
        }}
      >
        {/* Cabecalho: midia em destaque como banner, nome/status sobrepostos por
            baixo (fora da imagem) para nao perder legibilidade sobre fotos claras. */}
        <div style={{ position: "relative", flexShrink: 0, height: 320, background: "var(--bg)", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
          {creative.tipo_midia === "video" ? (
            <video
              src={creative.cloudinary_url}
              controls
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <img
              src={creative.cloudinary_url}
              alt={creative.nome}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          )}
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "rgba(20,33,61,0.55)", color: "#fff",
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: "18px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 18, fontWeight: 700 }}>{creative.nome}</strong>
            <StatusBadge status={creative.status} />
          </div>
          {creative.ad_name && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{creative.ad_name}</p>
          )}
        </div>

        {/* Abas em estilo underline, sem bordas quadradas -- indicador so uma
            linha de 2px embaixo do item ativo. */}
        <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              style={{
                padding: "8px 4px 12px", marginRight: 20, border: "none", background: "transparent",
                color: aba === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: aba === t.id ? 700 : 500, fontSize: 13.5, cursor: "pointer",
                borderBottom: aba === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "color 0.15s ease, border-color 0.15s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
          {aba === "implementacao" && (
            <>
              <Section title="Detalhes">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 24px" }}>
                  <Field label="Veículo" value={creative.veiculo} />
                  <Field label="Plataforma" value={creative.plataforma} />
                  <Field label="Campanha" value={creative.campanha} />
                  <Field label="Formato" value={creative.formato} />
                  <Field label="Tipo de compra" value={creative.tipos_compra?.length ? creative.tipos_compra.join(", ") : null} />
                  <Field label="Período de veiculação" value={periodo} />
                  <Field label="Título" value={creative.titulo} />
                  <Field label="Segmentação" value={creative.segmentacao} />
                  <Field label="Campaign Name" value={creative.campaign_name} />
                  <Field label="Ad Group" value={creative.conjunto} />
                  <Field label="Ad Name" value={creative.ad_name} />
                  <Field label="Tipo de publicação" value={creative.impulsionado === false ? "Dark Post" : "Impulsionado"} />
                  {creative.eh_performance && (
                    <Field
                      label="Orçamento projetado"
                      value={creative.orcamento_projetado ? Number(creative.orcamento_projetado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null}
                    />
                  )}
                </div>
              </Section>

              {creative.url_destino && (
                <Section title="URL de destino">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code
                      title={creative.url_destino}
                      style={{
                        flex: 1, minWidth: 0, fontFamily: "inherit", fontSize: 12.5, padding: "9px 12px", borderRadius: 8,
                        background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-primary)",
                        overflowX: "auto", whiteSpace: "nowrap",
                      }}
                    >
                      {creative.url_destino}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      title="Copiar link"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      <CopyIcon />
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </Section>
              )}

              {(creative.descricao || creative.observacoes) && (
                <Section title="Notas">
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Field label="Descrição" value={creative.descricao} />
                    <Field label="Observações" value={creative.observacoes} />
                  </div>
                </Section>
              )}
            </>
          )}

          {aba === "performance" && (
            <div>
              {!temPermissaoAnalise ? (
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "24px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                  Este vínculo não tem acesso à Análise por Criativo para esta plataforma.
                </div>
              ) : !temAdName ? (
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "24px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                  Este criativo não tem Ad Name cadastrado. Edite-o e informe o Ad Name (deve bater exatamente com o nome usado na planilha de Realizado) para ver os dados de performance.
                </div>
              ) : performance === undefined ? (
                <div style={{ padding: "40px 0" }}><Spinner /></div>
              ) : !performance ? (
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "24px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                  Nenhum dado de performance encontrado ainda para o Ad Name "{creative.ad_name}". Verifique se o nome bate exatamente com a planilha, ou aguarde a próxima sincronização.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                    <KpiCard bg="#eef3ea" color="#2E7D32" value={`R$ ${performance.investimento.toLocaleString("pt-BR")}`} label="Investimento" />
                    <KpiCard bg="var(--accent-soft)" color="var(--accent)" value={formatCompact(performance.impressoes)} label="Impressões" />
                    <KpiCard bg="#e8f2ec" color="#0B6E4F" value={formatCompact(performance.cliques)} label="Cliques" />
                    <KpiCard bg="#eef3ea" color="#2E7D32" value={`${performance.ctr}%`} label="CTR" />
                  </div>

                  {/* Metricas de custo/leads variam conforme o modelo de compra do
                      criativo -- CPM so mostra custo por mil, CPC mostra CPC+CPM,
                      CPL mostra Leads+CPC+CPM (os demais modelos de compra, como
                      CPV/CPE/CPT/CPF/CPA, nao tem regra especifica ainda, entao nao
                      exibem nenhuma dessas metricas extras). */}
                  {(() => {
                    const modelo = (creative.tipos_compra || [])[0];
                    const mostrarCpm = modelo === "CPM" || modelo === "CPC" || modelo === "CPL";
                    const mostrarCpc = modelo === "CPC" || modelo === "CPL";
                    const mostrarLeads = modelo === "CPL";
                    if (!mostrarCpm && !mostrarCpc && !mostrarLeads) return null;
                    const cols = [mostrarLeads, mostrarCpc, mostrarCpm].filter(Boolean).length;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
                        {mostrarLeads && (
                          <KpiCard
                            bg="#e6efe9"
                            color="#00695C"
                            value={performance.leads === null ? (creative.url_destino ? "Não configurado" : "Sem URL de destino") : formatCompact(performance.leads)}
                            label="Leads"
                          />
                        )}
                        {mostrarCpc && (
                          <KpiCard bg="#f0f2ea" color="#4E6B4A" value={`R$ ${performance.cpc.toLocaleString("pt-BR")}`} label="CPC" />
                        )}
                        {mostrarCpm && (
                          <KpiCard bg="var(--accent-soft)" color="var(--accent)" value={`R$ ${performance.cpm.toLocaleString("pt-BR")}`} label="CPM" />
                        )}
                      </div>
                    );
                  })()}

                  <KpiCard
                    bg="#e8f2ec"
                    color="#0B6E4F"
                    value={performance.sessoes === null ? "Sem GA4 vinculado" : formatCompact(performance.sessoes)}
                    label="Sessões"
                  />

                  <CreativeEvolutionChart
                    campanhaId={campanhaId}
                    veiculo={creative.plataforma}
                    adName={creative.ad_name}
                    filters={EMPTY_FILTERS}
                  />
                </div>
              )}
            </div>
          )}

          {aba === "comentarios" && <CommentsTab creativeId={creative.id} />}
        </div>
      </div>
    </div>
  );
}
