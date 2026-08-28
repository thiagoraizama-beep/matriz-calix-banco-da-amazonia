import { useEffect, useState } from "react";
import StatusBadge from "./statusBadge.jsx";
import CreativeEvolutionChart from "../creative/CreativeEvolutionChart.jsx";
import Spinner from "../common/Spinner.jsx";
import CommentsTab from "./CommentsTab.jsx";
import { OrcamentoBar } from "./CreativeGridCard.jsx";
import KeywordCloud from "./KeywordCloud.jsx";
import MediaCarousel from "./MediaCarousel.jsx";
import { getPerformancePorCampanha } from "../../api/client.js";

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

// Campo de texto longo (link) com botao de copiar -- mesmo padrao visual
// reaproveitado pra URL de destino e Link da publicacao.
function LinkComCopiar({ valor, campo, copiedField, onCopy }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <code
        title={valor}
        style={{
          flex: 1, minWidth: 0, fontFamily: "inherit", fontSize: 12.5, padding: "9px 12px", borderRadius: 8,
          background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-primary)",
          overflowX: "auto", whiteSpace: "nowrap",
        }}
      >
        {valor}
      </code>
      <button
        type="button"
        onClick={() => onCopy(campo, valor)}
        title="Copiar link"
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
      >
        <CopyIcon />
        {copiedField === campo ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

function formatPeriodo(inicio, fim) {
  if (!inicio && !fim) return null;
  const fmt = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
  if (inicio && fim) return `${fmt(inicio)} - ${fmt(fim)}`;
  return fmt(inicio || fim);
}

// Numera cada item da lista (Titulo 1: ..., Titulo 2: ...) em vez de so
// concatenar -- mais facil de contar/referenciar quando ha varios.
function listaNumerada(valores, rotulo) {
  if (!Array.isArray(valores) || valores.length === 0) return "";
  return valores.map((v, i) => `${rotulo} ${i + 1}: ${v}`).join("\n");
}

function formatCompact(value) {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("pt-BR");
}

function formatDuracao(segundos) {
  const total = Math.round(segundos || 0);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}m ${String(sec).padStart(2, "0")}s`;
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
      <p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 500, wordBreak: "break-word", whiteSpace: "pre-line" }}>
        {value || <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>—</span>}
      </p>
    </div>
  );
}

// Faixa de destaque no topo da aba Implementacao -- os 3 dados que mais
// importam de relance (Plataforma, Periodo, Verba), pra nao precisar caçar
// eles no meio da tabela de baixo.
function SummaryStrip({ itens }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${itens.length}, 1fr)`, gap: 1, background: "var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {itens.map((item) => (
        <div key={item.label} style={{ background: "var(--card-bg)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: item.accent ? "var(--accent)" : "var(--text-primary)" }}>
            {item.value || <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>—</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// Tabela compacta rotulo/valor -- usada nos grupos abaixo da faixa de
// destaque, mais densa que a grade de 2 colunas (Field/Section).
function TableRows({ linhas }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {linhas.map((linha) => (
          <tr key={linha.label} style={{ borderBottom: "1px solid var(--border)" }}>
            <td style={{ padding: "9px 12px 9px 0", color: "var(--text-secondary)", fontSize: 12, width: "38%", verticalAlign: "top" }}>{linha.label}</td>
            <td style={{ padding: "9px 0", fontWeight: 500, color: "var(--text-primary)", wordBreak: "break-word", verticalAlign: "top" }}>
              {linha.value || <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
export default function CreativeFusedDetailModal({
  creative, campanhaId, onClose, abaInicial = "implementacao", comentariosSomenteLeitura = false,
  onNavegar, listaNavegacao,
}) {
  const periodo = formatPeriodo(creative.periodo_inicio, creative.periodo_fim);
  const [copiedField, setCopiedField] = useState(null);
  const [aba, setAba] = useState(abaInicial);

  // Navegacao entre criativos (setas/teclado) sem fechar o modal -- so ativa
  // quando o chamador passou a lista completa que estava sendo exibida (ex: a
  // grade filtrada da Matriz), pra "anterior/proximo" respeitar o que o
  // usuario estava vendo, nao a lista bruta sem filtro.
  const indiceAtual = listaNavegacao?.findIndex((c) => c.id === creative.id) ?? -1;
  const temNavegacao = Boolean(onNavegar) && Array.isArray(listaNavegacao) && indiceAtual !== -1;

  function irPara(novoIndice) {
    if (novoIndice < 0 || novoIndice >= listaNavegacao.length) return;
    setAba("implementacao");
    onNavegar(listaNavegacao[novoIndice]);
  }

  useEffect(() => {
    if (!temNavegacao) return;
    function handleKeyDown(e) {
      if (e.key === "ArrowLeft") irPara(indiceAtual - 1);
      else if (e.key === "ArrowRight") irPara(indiceAtual + 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [temNavegacao, indiceAtual, listaNavegacao]);

  // Seção de Performance so e ocultada por completo quando o vinculo nao tem a
  // permissao (acesso_analise_criativo) -- sem ad_name ou sem match ainda, a aba
  // continua visivel com uma mensagem explicando o motivo, em vez de sumir sem aviso.
  const temPermissaoAnalise = creative.acesso_analise_criativo === true;
  const temAdName = Boolean(creative.ad_name);
  const [performance, setPerformance] = useState(undefined); // undefined=nao carregado ainda, null=sem dado

  useEffect(() => {
    if (aba !== "performance" || !temPermissaoAnalise || !temAdName || performance !== undefined) return;
    getPerformancePorCampanha(campanhaId)
      .then((mapa) => setPerformance(mapa[creative.id] || null))
      .catch(() => setPerformance(null));
  }, [aba, campanhaId, creative.id, temPermissaoAnalise, temAdName, performance]);

  function handleCopy(campo, valor) {
    if (!valor) return;
    navigator.clipboard.writeText(valor);
    setCopiedField(campo);
    setTimeout(() => setCopiedField(null), 1500);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16,
        animation: "creativeModalOverlayIn 0.15s ease-out",
      }}
    >
      {temNavegacao && listaNavegacao.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); irPara(indiceAtual - 1); }}
            disabled={indiceAtual <= 0}
            aria-label="Criativo anterior"
            className="creative-nav-arrow"
            style={{
              position: "fixed", left: 20, top: "50%", transform: "translateY(-50%)", zIndex: 301,
              width: 34, height: 34, borderRadius: "50%", border: "none", cursor: indiceAtual <= 0 ? "default" : "pointer",
              background: "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: indiceAtual <= 0 ? 0.25 : 0.8, transition: "opacity 0.15s ease, background 0.15s ease",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); irPara(indiceAtual + 1); }}
            disabled={indiceAtual >= listaNavegacao.length - 1}
            aria-label="Próximo criativo"
            className="creative-nav-arrow"
            style={{
              position: "fixed", right: 20, top: "50%", transform: "translateY(-50%)", zIndex: 301,
              width: 34, height: 34, borderRadius: "50%", border: "none", cursor: indiceAtual >= listaNavegacao.length - 1 ? "default" : "pointer",
              background: "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: indiceAtual >= listaNavegacao.length - 1 ? 0.25 : 0.8, transition: "opacity 0.15s ease, background 0.15s ease",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <style>{`
            .creative-nav-arrow:not(:disabled):hover { opacity: 1 !important; background: rgba(20,33,61,0.35) !important; }
          `}</style>
        </>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 1040, maxWidth: "100%", maxHeight: "calc(100vh - 32px)", overflowY: "auto",
          display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(10,16,32,0.35)",
          animation: "creativeModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Cabecalho: midia em destaque como banner, nome/status sobrepostos por
            baixo (fora da imagem) para nao perder legibilidade sobre fotos claras. */}
        <div style={{ position: "relative", flexShrink: 0, height: 320, background: "var(--bg)", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
          {creative.formato?.includes("Search") ? (
            <KeywordCloud palavrasChave={creative.search_campos?.palavrasChave} width={1040} height={320} />
          ) : (
            <MediaCarousel creative={creative} videoControls />
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

        <div key={aba} style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 24, animation: "creativeTabFadeIn 0.18s ease-out" }}>
          {aba === "implementacao" && (
            <>
              <SummaryStrip
                itens={[
                  { label: "Plataforma", value: [creative.plataforma, creative.formato?.join(", ")].filter(Boolean).join(" · ") },
                  { label: "Período", value: periodo },
                  {
                    label: "Verba",
                    accent: true,
                    value: creative.eh_performance && creative.orcamento_projetado
                      ? Number(creative.orcamento_projetado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : null,
                  },
                ]}
              />

              <Section title="Campanha e veículo">
                <TableRows
                  linhas={[
                    { label: "Campanha", value: creative.campanha },
                    { label: "Veículo", value: creative.veiculo },
                    { label: "Tipo de compra", value: creative.tipos_compra?.length ? creative.tipos_compra.join(", ") : null },
                    ...(creative.tipos_compra?.includes("CPL")
                      ? [{ label: "Formulário de captura", value: creative.formulario_nativo ? "Nativo da plataforma" : "Site/LP externa" }]
                      : []),
                    { label: "Publicação", value: creative.impulsionado === false ? "Dark Post" : "Impulsionado" },
                    { label: "Título", value: creative.titulo },
                    { label: "Segmentação", value: creative.segmentacao },
                  ]}
                />
              </Section>

              <Section title="Identificação e tracking">
                <TableRows
                  linhas={[
                    { label: "Campaign Name", value: creative.campaign_name },
                    { label: "Ad Group", value: creative.conjunto },
                    { label: "Ad Name", value: creative.ad_name },
                  ]}
                />
              </Section>

              {creative.formulario_nativo && creative.observacoes_formulario_nativo && (
                <Section title="Formulário nativo">
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
                    {creative.observacoes_formulario_nativo}
                  </p>
                </Section>
              )}

              {creative.search_campos && (
                creative.search_campos.titulo?.length > 0
                || creative.search_campos.tituloLongo?.length > 0
                || creative.search_campos.texto?.length > 0
                || creative.search_campos.palavrasChave
              ) && (
                <Section title="Google Search">
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {creative.search_campos.titulo?.length > 0 && (
                      <Field label="Títulos" value={listaNumerada(creative.search_campos.titulo, "Título")} />
                    )}
                    {creative.search_campos.tituloLongo?.length > 0 && (
                      <Field label="Títulos longos" value={listaNumerada(creative.search_campos.tituloLongo, "Título longo")} />
                    )}
                    {creative.search_campos.texto?.length > 0 && (
                      <Field label="Descrições" value={listaNumerada(creative.search_campos.texto, "Descrição")} />
                    )}
                    {creative.search_campos.palavrasChave && (
                      <Field label="Palavras-chave" value={creative.search_campos.palavrasChave} />
                    )}
                  </div>
                </Section>
              )}

              {creative.url_destino && (
                <Section title="URL de destino">
                  <LinkComCopiar valor={creative.url_destino} campo="urlDestino" copiedField={copiedField} onCopy={handleCopy} />
                </Section>
              )}

              {creative.impulsionado && (
                <Section title="Link da publicação">
                  {creative.link_postagem ? (
                    <LinkComCopiar valor={creative.link_postagem} campo="linkPostagem" copiedField={copiedField} onCopy={handleCopy} />
                  ) : (
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>
                      Ainda não preenchido. Cole o link na coluna "Link da publicação" da planilha do Sheets, se ela estiver vinculada.
                    </p>
                  )}
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

                  {creative.eh_performance && creative.orcamento_projetado > 0 && (
                    <OrcamentoBar orcamento={Number(creative.orcamento_projetado)} investido={performance.investimento} />
                  )}

                  {/* Metricas de custo/leads variam conforme o modelo de compra do
                      criativo -- CPM so mostra custo por mil, CPC mostra CPC+CPM,
                      CPL mostra Leads+Custo por Lead+CPC+CPM (os demais modelos de
                      compra, como CPV/CPE/CPT/CPF/CPA, nao tem regra especifica
                      ainda, entao nao exibem nenhuma dessas metricas extras). */}
                  {(() => {
                    const modelo = (creative.tipos_compra || [])[0];
                    const mostrarCpm = modelo === "CPM" || modelo === "CPC" || modelo === "CPL";
                    const mostrarCpc = modelo === "CPC" || modelo === "CPL";
                    const mostrarLeads = modelo === "CPL";
                    const mostrarCpl = modelo === "CPL";
                    if (!mostrarCpm && !mostrarCpc && !mostrarLeads) return null;
                    const cols = [mostrarLeads, mostrarCpl, mostrarCpc, mostrarCpm].filter(Boolean).length;
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
                        {mostrarCpl && (
                          <KpiCard
                            bg="#e6efe9"
                            color="#00695C"
                            value={!performance.leads ? "—" : `R$ ${performance.cpl.toLocaleString("pt-BR")}`}
                            label="Custo por Lead"
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

                  <div style={{ display: "grid", gridTemplateColumns: performance.sessoes !== null ? "1fr 1fr 1fr" : "1fr", gap: 12 }}>
                    <KpiCard
                      bg="#e8f2ec"
                      color="#0B6E4F"
                      value={
                        performance.sessoes !== null
                          ? formatCompact(performance.sessoes)
                          : creative.url_destino
                          ? "Sem GA4 vinculado"
                          : "Sem URL de destino"
                      }
                      label="Sessões"
                    />
                    {performance.sessoes !== null && (
                      <KpiCard bg="#e8f2ec" color="#0B6E4F" value={`R$ ${performance.cps.toLocaleString("pt-BR")}`} label="Custo por Sessão" />
                    )}
                    {performance.duracaoMediaSessao !== null && (
                      <KpiCard bg="#e8f2ec" color="#0B6E4F" value={formatDuracao(performance.duracaoMediaSessao)} label="Tempo Médio de Sessão" />
                    )}
                  </div>

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

          {aba === "comentarios" && <CommentsTab creativeId={creative.id} somenteLeitura={comentariosSomenteLeitura} />}
        </div>
      </div>
      <style>{`
        @keyframes creativeTabFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes creativeModalOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes creativeModalIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
