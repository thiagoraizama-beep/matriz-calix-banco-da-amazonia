import { useEffect, useState } from "react";
import StatusBadge from "./statusBadge.jsx";
import CreativeEvolutionChart from "../creative/CreativeEvolutionChart.jsx";
import Spinner from "../common/Spinner.jsx";
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

function Field({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 13, wordBreak: "break-word" }}>
        {value || <span style={{ color: "var(--text-secondary)" }}>—</span>}
      </p>
    </div>
  );
}

function KpiCard({ bg, color, value, label }) {
  return (
    <div className="card" style={{ background: bg }}>
      <strong style={{ fontSize: 18, color }}>{value}</strong>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>{label}</p>
    </div>
  );
}

const TABS = [
  { id: "implementacao", label: "Implementação" },
  { id: "performance", label: "Performance" },
];

// Modal unico de detalhe, dividido em 2 abas: "Implementacao" (cadastro, sempre
// instantaneo, vem do proprio objeto creative) e "Performance" (metricas completas
// -- Investimento/Impressoes/Cliques/CTR + Sessoes/Leads do GA4 + grafico -- buscada
// sob demanda so quando essa aba e aberta pela primeira vez, casando pelo Ad Name).
export default function CreativeFusedDetailModal({ creative, campanhaId, onClose }) {
  const periodo = formatPeriodo(creative.periodo_inicio, creative.periodo_fim);
  const [copied, setCopied] = useState(false);
  const [aba, setAba] = useState("implementacao");

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
        position: "fixed", inset: 0, background: "rgba(20,33,61,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 1123, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <strong style={{ fontSize: 16 }}>{creative.nome}</strong>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge status={creative.status} />
              {creative.ad_name && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{creative.ad_name}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              style={{
                padding: "9px 16px", borderRadius: "8px 8px 0 0", border: "1px solid var(--border)",
                borderBottom: aba === t.id ? "1px solid var(--card-bg)" : "1px solid var(--border)",
                background: aba === t.id ? "var(--card-bg)" : "transparent",
                color: aba === t.id ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: aba === t.id ? 700 : 400, fontSize: 13, cursor: "pointer",
                position: "relative", bottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {aba === "implementacao" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {creative.tipo_midia === "video" ? (
              <video
                src={creative.cloudinary_url}
                controls
                style={{ width: "100%", maxHeight: 280, borderRadius: 8, objectFit: "contain", background: "var(--bg)" }}
              />
            ) : (
              <img
                src={creative.cloudinary_url}
                alt={creative.nome}
                style={{ width: "100%", maxHeight: 280, borderRadius: 8, objectFit: "contain", background: "var(--bg)" }}
              />
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
            </div>

            <Field label="Descrição" value={creative.descricao} />

            {creative.url_destino && (
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>URL de destino</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <code
                    title={creative.url_destino}
                    style={{
                      flex: 1, minWidth: 0, fontFamily: "inherit", fontSize: 12, padding: "6px 10px", borderRadius: 6,
                      background: "var(--card-bg)", border: "1px solid var(--border)", color: "var(--text-primary)",
                      overflowX: "auto", whiteSpace: "nowrap",
                    }}
                  >
                    {creative.url_destino}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    title="Copiar link"
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    <CopyIcon />
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            )}

            <Field label="Observações" value={creative.observacoes} />
          </div>
        )}

        {aba === "performance" && (
          <div>
            {!temPermissaoAnalise ? (
              <div className="card" style={{ background: "var(--bg)", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                Este vínculo não tem acesso à Análise por Criativo para esta plataforma.
              </div>
            ) : !temAdName ? (
              <div className="card" style={{ background: "var(--bg)", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                Este criativo não tem Ad Name cadastrado. Edite-o e informe o Ad Name (deve bater exatamente com o nome usado na planilha de Realizado) para ver os dados de performance.
              </div>
            ) : performance === undefined ? (
              <div style={{ padding: "40px 0" }}><Spinner /></div>
            ) : !performance ? (
              <div className="card" style={{ background: "var(--bg)", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                Nenhum dado de performance encontrado ainda para o Ad Name "{creative.ad_name}". Verifique se o nome bate exatamente com a planilha, ou aguarde a próxima sincronização.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <KpiCard bg="#fdecec" color="var(--danger)" value={`R$ ${performance.investimento.toLocaleString("pt-BR")}`} label="Investimento" />
                  <KpiCard bg="var(--accent-soft)" color="var(--accent)" value={formatCompact(performance.impressoes)} label="Impressões" />
                  <KpiCard bg="#e8f8ee" color="var(--success)" value={formatCompact(performance.cliques)} label="Cliques" />
                  <KpiCard bg="#f3e8fd" color="#9333ea" value={`${performance.ctr}%`} label="CTR" />
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
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 12 }}>
                      {mostrarLeads && (
                        <KpiCard
                          bg="#e6f4ff"
                          color="#0369a1"
                          value={performance.leads === null ? (creative.url_destino ? "Não configurado" : "Sem URL de destino") : formatCompact(performance.leads)}
                          label="Leads"
                        />
                      )}
                      {mostrarCpc && (
                        <KpiCard bg="#fff7e6" color="#b45309" value={`R$ ${performance.cpc.toLocaleString("pt-BR")}`} label="CPC" />
                      )}
                      {mostrarCpm && (
                        <KpiCard bg="#eef2ff" color="#4338ca" value={`R$ ${performance.cpm.toLocaleString("pt-BR")}`} label="CPM" />
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 20 }}>
                  <KpiCard
                    bg="#fff7e6"
                    color="#b45309"
                    value={performance.sessoes === null ? "Sem GA4 vinculado" : formatCompact(performance.sessoes)}
                    label="Sessões"
                  />
                </div>

                <CreativeEvolutionChart
                  campanhaId={campanhaId}
                  veiculo={creative.plataforma}
                  adName={creative.ad_name}
                  filters={EMPTY_FILTERS}
                />
              </>
            )}
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
