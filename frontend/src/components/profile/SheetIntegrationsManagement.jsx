import { useEffect, useState } from "react";
import { getCampanhas, getSheetHeaders, saveCampanhaSheet, deleteCampanhaSheet, getGa4ServiceAccount } from "../../api/client.js";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import MultiSelectDropdown from "../layout/MultiSelectDropdown.jsx";

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Campos do sistema que podem ser mapeados para uma coluna real da planilha da
// campanha. "obrigatorio: true" bloqueia o Salvar sem essa coluna escolhida --
// sao os campos minimos para qualquer leitura de Analise por Criativo fazer
// sentido (data, plataforma, investimento, impressoes, cliques). Os demais sao
// opcionais porque nem toda planilha tem, por exemplo, dados de video.
const CAMPOS_MAPEAMENTO = [
  { key: "data", label: "Data", obrigatorio: true },
  { key: "plataforma", label: "Plataforma", obrigatorio: true },
  { key: "investimento", label: "Investimento (Custo)", obrigatorio: true },
  { key: "impressoes", label: "Impressões", obrigatorio: true },
  { key: "cliques", label: "Cliques", obrigatorio: true },
  { key: "campanha", label: "Campanha" },
  { key: "vendedor", label: "Veículo (vendor)" },
  { key: "adName", label: "Ad Name" },
  { key: "imagemCriativo", label: "Imagem do Criativo" },
  { key: "tipoCompra", label: "Tipo de Compra" },
  { key: "posicionamento", label: "Posicionamento" },
  { key: "videoViews", label: "Video Views" },
  { key: "videoViews25", label: "Video Views 25%" },
  { key: "videoViews50", label: "Video Views 50%" },
  { key: "videoViews75", label: "Video Views 75%" },
  { key: "videoCompletions", label: "Video Completions" },
  { key: "engajamentos", label: "Total Engagements" },
];

// Extrai o ID da planilha de uma URL colada inteira (ex:
// https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0) ou aceita o ID puro.
function extrairSpreadsheetId(value) {
  const trimmed = (value || "").trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

// O usuario so precisa digitar o NOME da aba (ex: "Consolidada") -- a notacao
// A1 do Google Sheets (NomeDaAba!A:Z) e completada automaticamente aqui, ja que
// exigir essa sintaxe do usuario e uma barreira desnecessaria. Se o usuario ja
// colar algo com "!" (ja no formato completo), respeita como veio.
function montarRange(nomeAba) {
  const trimmed = (nomeAba || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("!")) return trimmed;
  return `${trimmed}!A:Z`;
}

function mappingVazio(config) {
  const base = Object.fromEntries(CAMPOS_MAPEAMENTO.map((c) => [c.key, ""]));
  if (!config) return base;
  return {
    data: config.col_data || "",
    campanha: config.col_campanha || "",
    plataforma: config.col_plataforma || "",
    vendedor: config.col_vendedor || "",
    adName: config.col_ad_name || "",
    imagemCriativo: config.col_imagem_criativo || "",
    tipoCompra: config.col_tipo_compra || "",
    posicionamento: config.col_posicionamento || "",
    investimento: config.col_investimento || "",
    impressoes: config.col_impressoes || "",
    cliques: config.col_cliques || "",
    videoViews: config.col_video_views || "",
    videoViews25: config.col_video_views_25 || "",
    videoViews50: config.col_video_views_50 || "",
    videoViews75: config.col_video_views_75 || "",
    videoCompletions: config.col_video_completions || "",
    engajamentos: config.col_engajamentos || "",
  };
}

// Vincula cada campanha a sua propria planilha Google Sheets, com mapeamento de
// colunas configuravel -- diferente do modelo antigo (1 planilha global fixa no
// .env, com layout de colunas unico para todas as campanhas). Cada campanha pode
// ter uma planilha com nomes/ordem de coluna completamente diferentes.
export default function SheetIntegrationsManagement() {
  const [campanhas, setCampanhas] = useState(null);
  const [serviceAccountEmail, setServiceAccountEmail] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [spreadsheetInput, setSpreadsheetInput] = useState("");
  const [rangeInput, setRangeInput] = useState("");
  const [headers, setHeaders] = useState(null);
  const [mapping, setMapping] = useState({});
  const [carregandoHeaders, setCarregandoHeaders] = useState(false);
  const [erroHeaders, setErroHeaders] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [errorId, setErrorId] = useState(null);
  const [removendo, setRemovendo] = useState(null);

  function load() {
    getCampanhas().then(setCampanhas).catch(console.error);
  }

  useEffect(() => {
    load();
    getGa4ServiceAccount().then((r) => setServiceAccountEmail(r.email)).catch(console.error);
  }, []);

  function handleCopyEmail() {
    if (!serviceAccountEmail) return;
    navigator.clipboard.writeText(serviceAccountEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function abrirEdicao(c) {
    const config = c.sheetConfig;
    setSpreadsheetInput(config?.spreadsheet_id || "");
    setRangeInput(config?.sheet_range || "");
    setHeaders(null);
    setMapping(mappingVazio(config));
    setErroHeaders("");
    setErrorId(null);
    setEditandoId(c.id);
  }

  function fecharEdicao() {
    setEditandoId(null);
    setHeaders(null);
    setSpreadsheetInput("");
    setRangeInput("");
    setErroHeaders("");
  }

  async function handleCarregarColunas() {
    const spreadsheetId = extrairSpreadsheetId(spreadsheetInput);
    if (!spreadsheetId || !rangeInput.trim()) {
      setErroHeaders("Informe o ID/URL da planilha e o nome da aba");
      return;
    }
    setCarregandoHeaders(true);
    setErroHeaders("");
    try {
      const { headers: hs } = await getSheetHeaders(spreadsheetId, montarRange(rangeInput));
      setHeaders(hs);
    } catch (err) {
      setErroHeaders(err.response?.data?.error || "Não foi possível carregar as colunas da planilha");
    } finally {
      setCarregandoHeaders(false);
    }
  }

  async function handleSalvar(campanhaId) {
    setSavingId(campanhaId);
    setErrorId(null);
    try {
      await saveCampanhaSheet(campanhaId, {
        spreadsheetId: extrairSpreadsheetId(spreadsheetInput),
        range: montarRange(rangeInput),
        mapping,
      });
      fecharEdicao();
      load();
    } catch (err) {
      setErrorId(campanhaId);
      console.error("Falha ao salvar vínculo de planilha:", err);
    } finally {
      setSavingId(null);
    }
  }

  async function handleConfirmarRemover() {
    const campanhaId = removendo.id;
    setSavingId(campanhaId);
    try {
      await deleteCampanhaSheet(campanhaId);
      setRemovendo(null);
      fecharEdicao();
      load();
    } catch (err) {
      console.error("Falha ao remover vínculo de planilha:", err);
    } finally {
      setSavingId(null);
    }
  }

  const camposObrigatoriosPreenchidos = CAMPOS_MAPEAMENTO.filter((c) => c.obrigatorio).every((c) => mapping[c.key]);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <p className="card-title" style={{ margin: 0 }}>Integrações de Planilha</p>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 16px" }}>
        Vincule a planilha Google Sheets de cada campanha e mapeie quais colunas dela correspondem a cada campo do
        sistema (o layout pode variar entre campanhas). A conta de serviço configurada no servidor precisa ter
        acesso de <strong>Leitor</strong> na planilha.
      </p>

      {serviceAccountEmail && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 20,
            borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)",
          }}
        >
          <code style={{ flex: 1, fontFamily: "inherit", fontSize: 12.5, overflowX: "auto", whiteSpace: "nowrap" }}>
            {serviceAccountEmail}
          </code>
          <button
            onClick={handleCopyEmail}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <CopyIcon /> {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      )}

      {!campanhas ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Carregando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {campanhas.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.nome}
                </span>

                {editandoId !== c.id && (
                  c.sheetConfig ? (
                    <>
                      <code style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.sheetConfig.spreadsheet_id} · {c.sheetConfig.sheet_range}
                      </code>
                      <button
                        onClick={() => abrirEdicao(c)}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setRemovendo(c)}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}
                      >
                        Excluir
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => abrirEdicao(c)}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Vincular
                    </button>
                  )
                )}
              </div>

              {errorId === c.id && (
                <span style={{ fontSize: 11.5, color: "var(--danger)" }}>
                  Não foi possível salvar. Confira os dados e tente novamente.
                </span>
              )}

              {editandoId === c.id && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      value={spreadsheetInput}
                      onChange={(e) => setSpreadsheetInput(e.target.value)}
                      placeholder="URL ou ID da planilha"
                      style={{ flex: "1 1 260px", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-primary)", fontSize: 12.5 }}
                    />
                    <input
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                      placeholder="Nome da aba (ex: Consolidada)"
                      style={{ flex: "1 1 220px", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-primary)", fontSize: 12.5 }}
                    />
                    <button
                      onClick={handleCarregarColunas}
                      disabled={carregandoHeaders}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: carregandoHeaders ? "default" : "pointer", opacity: carregandoHeaders ? 0.6 : 1 }}
                    >
                      {carregandoHeaders ? "Carregando..." : "Carregar colunas"}
                    </button>
                  </div>

                  {erroHeaders && (
                    <span style={{ fontSize: 11.5, color: "var(--danger)" }}>{erroHeaders}</span>
                  )}

                  {headers && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                      {CAMPOS_MAPEAMENTO.map((campo) => (
                        <div key={campo.key}>
                          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>
                            {campo.label}{campo.obrigatorio ? " *" : ""}
                          </label>
                          <MultiSelectDropdown
                            value={mapping[campo.key] || null}
                            onChange={(v) => setMapping((prev) => ({ ...prev, [campo.key]: v || "" }))}
                            options={headers.filter((h) => h === mapping[campo.key] || !Object.values(mapping).includes(h))}
                            placeholder="Nenhuma"
                            compact
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={fecharEdicao}
                      disabled={savingId === c.id}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSalvar(c.id)}
                      disabled={!headers || !camposObrigatoriosPreenchidos || savingId === c.id}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
                        fontSize: 13, fontWeight: 600,
                        cursor: !headers || !camposObrigatoriosPreenchidos || savingId === c.id ? "default" : "pointer",
                        opacity: !headers || !camposObrigatoriosPreenchidos || savingId === c.id ? 0.6 : 1,
                      }}
                    >
                      {savingId === c.id ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {campanhas.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Nenhuma campanha cadastrada ainda.</p>
          )}
        </div>
      )}

      {removendo && (
        <ConfirmDialog
          title="Remover vínculo de planilha"
          message={`Tem certeza que deseja remover o vínculo de planilha de "${removendo.nome}"? Todo o mapeamento de colunas será perdido e vai precisar ser refeito.`}
          onConfirm={handleConfirmarRemover}
          onCancel={() => setRemovendo(null)}
        />
      )}
    </div>
  );
}
