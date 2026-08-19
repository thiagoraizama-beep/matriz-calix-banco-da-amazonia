import { useEffect, useRef, useState } from "react";
import { createMatrixCreative, createMatrixCreativeRascunho, updateMatrixCreative, deleteMatrixCreative, getCampanhas } from "../../../api/client.js";
import SearchSelect from "../../layout/SearchSelect.jsx";
import SimpleDateRangeFields from "../../layout/SimpleDateRangeFields.jsx";

const TODOS_FORMATOS = [
  "Feed", "Stories", "Reels", "Carrossel", "Coleção", "Instant Experience", "Messenger",
  "In-Feed", "TopView", "Brand Takeover", "Branded Hashtag Challenge", "Branded Effect", "Spark Ads",
  "In-Stream Pulável", "In-Stream Não Pulável", "Bumper Ad", "Discovery", "Shorts", "Masthead",
  "Kwai In-Feed", "Kwai TopView",
  "Audio Ad", "Podcast Ad", "Branded Playlist", "Display Audio",
  "Display", "Display Rich Media", "Interstitial", "Native", "Skin / Roadblock",
  "Banner", "Half Page", "Billboard", "Pop-Under",
  "DOOH", "OOH Outdoor", "OOH Mobiliário Urbano", "DOOH Metro", "DOOH Aeroporto",
  "VT 30s", "VT 15s", "VT 60s", "Spot Rádio 30s", "Spot Rádio 60s", "Merchandising",
  "Banner Home", "Sponsored Content", "Newsletter", "Push Notification",
  "Influencer Post", "Live", "Stories Interativo", "Link Patrocinado",
];

const TIPOS_COMPRA_OPTIONS = ["CPC", "CPM", "CPV", "CPE", "CPL", "CPT", "CPF", "CPA"];

// Abas do formulario, cada uma agrupando campos relacionados -- em vez de uma
// unica lista vertical de ~18 campos, quebra em blocos digestiveis. Cada campo
// obrigatorio mapeia pra uma aba (ver CAMPO_PARA_ABA abaixo), usado pra pular
// automaticamente pra aba certa quando a validacao falha num campo que esta
// numa aba diferente da atual.
const TABS = [
  { id: "basico", label: "Básico" },
  { id: "compra", label: "Compra e formato" },
  { id: "detalhes", label: "Detalhes técnicos" },
  { id: "notas", label: "Notas" },
];

const CAMPO_PARA_ABA = {
  linkPostagem: "basico", file: "basico", campanha: "basico", veiculo: "basico", plataforma: "basico", nome: "basico",
  tipoCompra: "compra", formato: "compra", periodo: "compra",
  adName: "detalhes",
};

function Field({ label, children, invalid }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: invalid ? "var(--danger)" : "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: invalid ? 700 : 500 }}>
        {label}
      </label>
      <div style={invalid ? { outline: "1px solid var(--danger)", borderRadius: 8 } : undefined}>
        {children}
      </div>
    </div>
  );
}

export default function CreativeFormModal({ creative, onClose, onSaved }) {
  const isEdit = Boolean(creative?.id) && !creative?._duplicate;
  const title = creative?._duplicate ? "Duplicar criativo" : isEdit ? "Editar criativo" : "Novo criativo";

  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" };
  const textareaStyle = { ...inputStyle, fontFamily: "inherit", resize: "vertical" };

  const [nome, setNome] = useState(creative?.nome || "");
  const [adName, setAdName] = useState((creative?.ad_name || "").replace(/\s+/g, " ").trim());
  const [campaignName, setCampaignName] = useState(creative?.campaign_name || "");
  const [campanha, setCampanha] = useState(creative?.campanha || "");
  const [veiculo, setVeiculo] = useState(creative?.veiculo || "");
  const [conjunto, setConjunto] = useState(creative?.conjunto || "");
  const [formato, setFormato] = useState(creative?.formato || "");
  const [plataforma, setPlataforma] = useState(creative?.plataforma || "");
  const [posicionamento, setPosicionamento] = useState(creative?.posicionamento || "");
  const [urlDestino, setUrlDestino] = useState(creative?.url_destino || "");
  const [impulsionado, setImpulsionado] = useState(creative?.impulsionado !== false);
  const [linkPostagem, setLinkPostagem] = useState(creative?.link_postagem || "");
  const [ehPerformance, setEhPerformance] = useState(creative?.eh_performance === true);
  // Guardado em centavos (inteiro) para a mascara de moeda preencher da direita
  // para a esquerda, tipo campo de valor de app bancario (digita "1000" -> "R$ 10,00").
  const [orcamentoCentavos, setOrcamentoCentavos] = useState(
    creative?.orcamento_projetado ? Math.round(Number(creative.orcamento_projetado) * 100) : 0
  );
  const [segmentacao, setSegmentacao] = useState(creative?.segmentacao || "");
  const [titulo, setTitulo] = useState(creative?.titulo || "");
  const [tipoCompra, setTipoCompra] = useState(creative?.tipos_compra?.[0] || "");
  const [periodoInicio, setPeriodoInicio] = useState(creative?.periodo_inicio?.slice(0, 10) || "");
  const [periodoFim, setPeriodoFim] = useState(creative?.periodo_fim?.slice(0, 10) || "");
  const [descricao, setDescricao] = useState(creative?.descricao || "");
  const [observacoes, setObservacoes] = useState(creative?.observacoes || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(creative?.cloudinary_url || null);
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [campoInvalido, setCampoInvalido] = useState(null);

  const [campanhaOptions, setCampanhaOptions] = useState([]);
  const [veiculoOptions, setVeiculoOptions] = useState([]);
  const [campanhaData, setCampanhaData] = useState([]);
  const [plataformasVeiculo, setPlataformasVeiculo] = useState([]);
  const [campanhaVeiculoId, setCampanhaVeiculoId] = useState(creative?.campanha_veiculo_id || null);
  const [confirmandoFechar, setConfirmandoFechar] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("basico");

  useEffect(() => {
    getCampanhas()
      .then((list) => {
        setCampanhaData(list);
        setCampanhaOptions(list.map((c) => c.nome));
      })
      .catch(console.error);
  }, []);

  // Deriva veiculoOptions/plataformasVeiculo/campanhaVeiculoId a partir de campanhaData+campanha+veiculo
  // sempre de forma idempotente (recalcula do zero, nao depende de "rodou uma vez") -- robusto contra
  // remontagens do StrictMode em dev, que quebravam a logica antiga baseada em refs consumidos uma unica vez.
  useEffect(() => {
    if (campanhaData.length === 0 || !campanha) {
      setVeiculoOptions([]);
      return;
    }
    const found = campanhaData.find((c) => c.nome === campanha);
    setVeiculoOptions(found?.veiculos?.length ? found.veiculos.map((v) => v.nome) : []);
  }, [campanhaData, campanha]);

  useEffect(() => {
    if (campanhaData.length === 0 || !campanha || !veiculo) {
      setPlataformasVeiculo([]);
      setCampanhaVeiculoId(null);
      return;
    }
    const found = campanhaData.find((c) => c.nome === campanha);
    const veiculoData = found?.veiculos?.find((v) => v.nome === veiculo);
    setPlataformasVeiculo(veiculoData?.plataformas || []);
    setCampanhaVeiculoId(veiculoData?.id || null);
  }, [campanhaData, campanha, veiculo]);

  // Handlers chamados pelo usuario ao trocar campanha/veiculo manualmente -- limpam os
  // campos dependentes (plataforma nao faz mais sentido se o veiculo mudou, por ex).
  function handleCampanhaChange(v) {
    setCampanha(v || "");
    setVeiculo("");
    setPlataforma("");
  }

  function handleVeiculoChange(v) {
    setVeiculo(v || "");
    setPlataforma("");
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : creative?.cloudinary_url || null);
  }


  const MENSAGEM_CAMPO_PENDENTE = "Preencha os campos pendentes";

  function validarCamposObrigatorios() {
    if (impulsionado) {
      if (!linkPostagem.trim()) return { campo: "linkPostagem", mensagem: MENSAGEM_CAMPO_PENDENTE };
    } else if (!isEdit && !file && !creative?.cloudinary_url) {
      return { campo: "file", mensagem: MENSAGEM_CAMPO_PENDENTE };
    }
    if (!campanha) return { campo: "campanha", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!veiculo) return { campo: "veiculo", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!plataforma) return { campo: "plataforma", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!tipoCompra) return { campo: "tipoCompra", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!nome.trim()) return { campo: "nome", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!adName.trim()) return { campo: "adName", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!formato) return { campo: "formato", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!periodoInicio || !periodoFim) return { campo: "periodo", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (periodoInicio > periodoFim) return { campo: "periodo", mensagem: "A data inicial não pode ser depois da data final" };
    return null;
  }

  // Monta o FormData comum a criacao/edicao/rascunho -- evita repetir os mesmos
  // ~20 fd.append em tres lugares. isRascunho pula a normalizacao de URL (nao
  // faz sentido "corrigir" um campo que o usuario pode nem ter preenchido ainda).
  function montarFormData({ incluirMidiaExistente }) {
    const fd = new FormData();
    if (file) fd.append("file", file);
    if (!file && incluirMidiaExistente && creative?.cloudinary_url) {
      fd.append("cloudinaryUrl", creative.cloudinary_url);
      fd.append("cloudinaryPublicId", creative.cloudinary_public_id);
      fd.append("tipoMidia", creative.tipo_midia);
    }
    const urlDestinoNormalizada = urlDestino.trim() && !/^https?:\/\//i.test(urlDestino.trim())
      ? `https://${urlDestino.trim()}`
      : urlDestino.trim();
    fd.append("nome", nome);
    fd.append("adName", adName);
    fd.append("campaignName", campaignName);
    fd.append("campanha", campanha);
    fd.append("veiculo", veiculo);
    fd.append("plataforma", plataforma);
    fd.append("conjunto", conjunto);
    fd.append("formato", formato);
    fd.append("posicionamento", posicionamento);
    fd.append("urlDestino", urlDestinoNormalizada);
    fd.append("impulsionado", String(impulsionado));
    fd.append("linkPostagem", linkPostagem);
    fd.append("ehPerformance", String(ehPerformance));
    if (ehPerformance) fd.append("orcamentoProjetado", String(orcamentoCentavos / 100));
    fd.append("segmentacao", segmentacao);
    fd.append("titulo", titulo);
    fd.append("tiposCompra", JSON.stringify(tipoCompra ? [tipoCompra] : []));
    if (campanhaVeiculoId) fd.append("campanhaVeiculoId", campanhaVeiculoId);
    if (periodoInicio) fd.append("periodoInicio", periodoInicio);
    if (periodoFim) fd.append("periodoFim", periodoFim);
    fd.append("descricao", descricao);
    fd.append("observacoes", observacoes);
    return fd;
  }

  // Ha alguma alteracao que valha perguntar "salvar como rascunho?" ao fechar --
  // criativo novo com qualquer campo preenchido, ou edicao de um rascunho
  // existente com qualquer mudanca. Nao dispara em edicao de um criativo ja
  // "de verdade" (fechar sem salvar ali so descarta a edicao, como sempre foi).
  const ehRascunhoOuNovo = !isEdit || creative?.status === "Rascunho";
  const temAlgumCampoPreenchido = Boolean(
    file || nome.trim() || adName.trim() || campanha || veiculo || plataforma ||
    conjunto || formato || urlDestino.trim() || linkPostagem.trim() || segmentacao.trim() ||
    titulo.trim() || tipoCompra || periodoInicio || periodoFim || descricao.trim() || observacoes.trim()
  );

  async function handleSubmit(e) {
    e?.preventDefault();
    setError("");
    setCampoInvalido(null);
    const erroValidacao = validarCamposObrigatorios();
    if (erroValidacao) {
      setError(erroValidacao.mensagem);
      setCampoInvalido(erroValidacao.campo);
      setAbaAtiva(CAMPO_PARA_ABA[erroValidacao.campo] || "basico");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const fd = montarFormData({ incluirMidiaExistente: false });
        if (creative.status === "Rascunho") fd.append("publicarRascunho", "true");
        await updateMatrixCreative(creative.id, fd);
      } else {
        const fd = montarFormData({ incluirMidiaExistente: true });
        await createMatrixCreative(fd);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar criativo");
    } finally {
      setSaving(false);
    }
  }

  async function handleSalvarRascunho() {
    setSaving(true);
    try {
      const fd = montarFormData({ incluirMidiaExistente: true });
      if (isEdit) {
        await updateMatrixCreative(creative.id, fd);
      } else {
        await createMatrixCreativeRascunho(fd);
      }
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      onClose();
    }
  }

  // Avanca pro proximo passo do wizard, mas so se nao houver campo obrigatorio
  // pendente ATE o passo atual (inclusive) -- um erro que pertence a um passo
  // futuro nao bloqueia o avanco, ja que o usuario ainda vai chegar la.
  function handleProximo() {
    const erroValidacao = validarCamposObrigatorios();
    const indiceAtual = TABS.findIndex((t) => t.id === abaAtiva);
    const indiceErro = erroValidacao ? TABS.findIndex((t) => t.id === (CAMPO_PARA_ABA[erroValidacao.campo] || "basico")) : -1;
    if (erroValidacao && indiceErro <= indiceAtual) {
      setError(erroValidacao.mensagem);
      setCampoInvalido(erroValidacao.campo);
      return;
    }
    setError("");
    setCampoInvalido(null);
    setAbaAtiva(TABS[indiceAtual + 1].id);
  }

  function handleVoltar() {
    const indiceAtual = TABS.findIndex((t) => t.id === abaAtiva);
    if (indiceAtual > 0) setAbaAtiva(TABS[indiceAtual - 1].id);
  }

  function handleFechar() {
    if (ehRascunhoOuNovo && temAlgumCampoPreenchido) {
      setConfirmandoFechar(true);
      return;
    }
    onClose();
  }

  // "Descartar": se ja existe um rascunho salvo no banco (reabriu um pra editar
  // e decidiu jogar fora), exclui de verdade -- limpa Cloudinary tambem, mesma
  // rota usada pra exclusao normal. Se e um criativo novo que nunca foi salvo
  // (nem como rascunho), so fecha -- nao ha nada no banco pra excluir.
  async function handleDescartar() {
    if (isEdit && creative?.status === "Rascunho") {
      try {
        await deleteMatrixCreative(creative.id);
        onSaved();
      } catch (err) {
        console.error(err);
      }
    }
    setConfirmandoFechar(false);
    onClose();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
    >
      <div
        style={{
          width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto",
          display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(10,16,32,0.35)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" }}>
          <strong style={{ fontSize: 17, fontWeight: 700 }}>{title}</strong>
          <button
            type="button"
            onClick={handleFechar}
            aria-label="Fechar"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Indicador de progresso (wizard) -- passos numerados, ligados por uma
            linha, sempre clicaveis em qualquer direcao (ir e voltar livremente).
            A validacao dos campos obrigatorios so acontece no Salvar final, nao
            mais bloqueando o avanco entre passos. */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 24px 0" }}>
          {TABS.map((t, i) => {
            const indiceAtivo = TABS.findIndex((x) => x.id === abaAtiva);
            const temErroNestaAba = campoInvalido && CAMPO_PARA_ABA[campoInvalido] === t.id;
            const concluido = i < indiceAtivo;
            const ativo = t.id === abaAtiva;
            const podeClicar = true;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", flex: i < TABS.length - 1 ? 1 : "0 0 auto" }}>
                <button
                  type="button"
                  onClick={() => podeClicar && setAbaAtiva(t.id)}
                  disabled={!podeClicar}
                  title={t.label}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    width: 28, height: 28, borderRadius: "50%", fontSize: 12, fontWeight: 700,
                    border: `2px solid ${temErroNestaAba ? "var(--danger)" : ativo || concluido ? "var(--accent)" : "var(--border)"}`,
                    background: temErroNestaAba ? "rgba(220,38,38,0.1)" : concluido ? "var(--accent)" : ativo ? "var(--accent-soft)" : "var(--card-bg)",
                    color: temErroNestaAba ? "var(--danger)" : concluido ? "#fff" : ativo ? "var(--accent)" : "var(--text-secondary)",
                    cursor: podeClicar ? "pointer" : "default",
                  }}
                >
                  {concluido && !temErroNestaAba ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>
                {i < TABS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < indiceAtivo ? "var(--accent)" : "var(--border)", marginLeft: 4 }} />
                )}
              </div>
            );
          })}
        </div>
        <p style={{ margin: "10px 24px 0", fontSize: 14, fontWeight: 700 }}>
          {TABS.find((t) => t.id === abaAtiva)?.label}
        </p>
        <div style={{ height: 1, background: "var(--border)", margin: "12px 24px 0" }} />

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          {abaAtiva === "basico" && (
            <>
              {/* Impulsionado / Darkpost -- decide o que aparece no campo seguinte:
                  Impulsionado pede o link do post ja publicado, Dark Post exige upload
                  de arquivo (nao existe como post organico). */}
              <Field label="Tipo de publicação">
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ label: "Impulsionado", val: true }, { label: "Dark Post", val: false }].map(({ label, val }) => {
                    const sel = impulsionado === val;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setImpulsionado(val)}
                        style={{
                          flex: 1, padding: "9px 12px", borderRadius: 10, border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                          background: sel ? "var(--accent-soft)" : "transparent", color: sel ? "var(--accent)" : "var(--text-secondary)",
                          fontSize: 13, fontWeight: sel ? 700 : 500, cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {impulsionado && (
                <Field label="Link da postagem *" invalid={campoInvalido === "linkPostagem"}>
                  <input
                    value={linkPostagem}
                    onChange={(e) => setLinkPostagem(e.target.value)}
                    type="text"
                    placeholder="https://..."
                    style={inputStyle}
                  />
                </Field>
              )}

              {/* Arquivo -- obrigatorio so para Dark Post (nao existe post organico pra
                  linkar); em Impulsionado fica opcional, so para ter uma imagem de
                  preview do card na Matriz (o usuario pode subir um print/download da
                  peca se quiser). */}
              <Field
                label={impulsionado ? "Arquivo (opcional, para preview)" : isEdit ? "Arquivo (imagem ou vídeo)" : "Arquivo (imagem ou vídeo) *"}
                invalid={campoInvalido === "file"}
              >
                {preview && (
                  <div style={{ marginBottom: 10, borderRadius: 10, overflow: "hidden", maxHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
                    {(file ? file.type?.startsWith("video") : creative?.tipo_midia === "video") ? (
                      <video src={preview} style={{ maxHeight: 160, maxWidth: "100%" }} controls />
                    ) : (
                      <img src={preview} alt="preview" style={{ maxHeight: 160, maxWidth: "100%", objectFit: "contain" }} />
                    )}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    {isEdit ? "Trocar arquivo" : "Escolher arquivo"}
                  </button>
                  {file && (
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                      {file.name}
                    </span>
                  )}
                  {isEdit && file && (
                    <button
                      type="button"
                      onClick={() => { setFile(null); setPreview(creative?.cloudinary_url || null); }}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                    >
                      Cancelar troca
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ display: "none" }} />
              </Field>

              {/* Campanha → carrega veículos */}
              <Field label="Campanha *" invalid={campoInvalido === "campanha"}>
                <SearchSelect
                  value={campanha}
                  onChange={handleCampanhaChange}
                  options={campanhaOptions}
                  placeholder="Selecione a campanha..."
                  allowFreeText
                />
              </Field>

              {/* Veículo — carregado a partir da campanha */}
              <Field label="Veículo *" invalid={campoInvalido === "veiculo"}>
                <SearchSelect
                  value={veiculo}
                  onChange={handleVeiculoChange}
                  options={veiculoOptions}
                  placeholder={campanha ? "Selecione o veículo..." : "Selecione a campanha primeiro"}
                  allowFreeText
                />
                {plataformasVeiculo.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 11.5, color: campoInvalido === "plataforma" ? "var(--danger)" : "var(--text-secondary)", display: "block", marginBottom: 6, fontWeight: campoInvalido === "plataforma" ? 700 : 500 }}>
                      Plataforma *
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {plataformasVeiculo.map((p) => {
                        const sel = plataforma === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPlataforma(sel ? "" : p)}
                            style={{
                              padding: "5px 13px",
                              borderRadius: 999,
                              border: "1px solid",
                              borderColor: sel ? "var(--accent)" : campoInvalido === "plataforma" ? "var(--danger)" : "var(--border)",
                              background: sel ? "var(--accent)" : "transparent",
                              color: sel ? "#fff" : "var(--text-secondary)",
                              fontSize: 12,
                              fontWeight: sel ? 700 : 500,
                              cursor: "pointer",
                            }}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Field>

              {/* Nome do criativo */}
              <Field label="Nome do criativo *" invalid={campoInvalido === "nome"}>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required style={inputStyle} />
              </Field>
            </>
          )}

          {abaAtiva === "compra" && (
            <>
              {/* Tipo de compra — seleção única */}
              <Field label="Tipo de compra *" invalid={campoInvalido === "tipoCompra"}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TIPOS_COMPRA_OPTIONS.map((t) => {
                    const sel = tipoCompra === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoCompra(sel ? "" : t)}
                        style={{
                          padding: "5px 13px",
                          borderRadius: 999,
                          border: "1px solid",
                          borderColor: sel ? "var(--accent)" : campoInvalido === "tipoCompra" ? "var(--danger)" : "var(--border)",
                          background: sel ? "var(--accent)" : "transparent",
                          color: sel ? "#fff" : "var(--text-secondary)",
                          fontSize: 12,
                          fontWeight: sel ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Formato */}
              <Field label="Formato *" invalid={campoInvalido === "formato"}>
                <SearchSelect
                  value={formato}
                  onChange={(v) => setFormato(v || "")}
                  options={TODOS_FORMATOS}
                  placeholder="Stories, Reels, Feed..."
                  allowFreeText
                />
              </Field>

              {/* Período */}
              <Field label="Período de veiculação *" invalid={campoInvalido === "periodo"}>
                <SimpleDateRangeFields
                  start={periodoInicio}
                  end={periodoFim}
                  onChange={(s, en) => { setPeriodoInicio(s); setPeriodoFim(en); }}
                />
              </Field>

              {/* Performance -- independente do tipo de publicacao (Impulsionado ou Dark
                  Post). Quando marcado, o card na Matriz mostra uma barra comparando o
                  orcamento projetado aqui com o investimento real vindo da planilha
                  (coluna Cost). */}
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input type="checkbox" checked={ehPerformance} onChange={(e) => setEhPerformance(e.target.checked)} />
                  Performance (acompanhar orçamento projetado x investido)
                </label>

                {ehPerformance && (
                  <Field label="Orçamento projetado">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={(orcamentoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      onChange={(e) => {
                        // So digitos contam -- cada digito novo "empurra" os centavos, exatamente
                        // como um campo de valor de app bancario.
                        const digitos = e.target.value.replace(/\D/g, "");
                        setOrcamentoCentavos(digitos ? Number(digitos) : 0);
                      }}
                      style={inputStyle}
                    />
                  </Field>
                )}
              </div>
            </>
          )}

          {abaAtiva === "detalhes" && (
            <>
              {/* Ad Name */}
              <Field label="Ad Name *" invalid={campoInvalido === "adName"}>
                <input
                  value={adName}
                  onChange={(e) => setAdName(e.target.value)}
                  placeholder="Deve bater exatamente com o Ad Name da planilha"
                  style={inputStyle}
                />
              </Field>

              {/* Campaign Name (técnico) */}
              <Field label="Campaign Name">
                <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} style={inputStyle} placeholder="Ex: BR_CAMPANHA-INSTITUCIONAL-2026_CPM" />
              </Field>

              {/* Conjunto / Ad Group */}
              <Field label="Ad Group">
                <input value={conjunto} onChange={(e) => setConjunto(e.target.value)} style={inputStyle} />
              </Field>

              {/* URL destino */}
              <Field label="URL de destino">
                <input value={urlDestino} onChange={(e) => setUrlDestino(e.target.value)} type="text" placeholder="https://" style={inputStyle} />
              </Field>

              {/* Segmentação */}
              <Field label="Segmentação">
                <textarea value={segmentacao} onChange={(e) => setSegmentacao(e.target.value)} rows={2} style={textareaStyle} placeholder="Descreva o público-alvo..." />
              </Field>

              {/* Título */}
              <Field label="Título do criativo">
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={inputStyle} />
              </Field>
            </>
          )}

          {abaAtiva === "notas" && (
            <>
              {/* Descrição */}
              <Field label="Descrição">
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} style={textareaStyle} />
              </Field>

              {/* Observações */}
              <Field label="Observações">
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} style={textareaStyle} />
              </Field>
            </>
          )}

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(220,38,38,0.1)", color: "var(--danger)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {abaAtiva !== "basico" && (
              <button
                type="button"
                onClick={handleVoltar}
                style={{ padding: "11px 20px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Voltar
              </button>
            )}
            {abaAtiva !== "notas" ? (
              <button
                type="button"
                onClick={handleProximo}
                style={{ flex: 1, padding: "11px 0", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Salvando..." : isEdit ? "Salvar alterações" : creative?._duplicate ? "Criar cópia" : "Criar criativo"}
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmandoFechar && (
        <div
          onClick={() => setConfirmandoFechar(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 250 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 360, display: "flex", flexDirection: "column", gap: 14 }}>
            <strong style={{ fontSize: 15 }}>Alterações não salvas</strong>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Você preencheu campos deste criativo mas não confirmou a criação. Quer salvar como rascunho para continuar depois?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={handleSalvarRascunho}
                disabled={saving}
                style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Salvando..." : "Salvar como rascunho"}
              </button>
              <button
                onClick={handleDescartar}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Descartar
              </button>
              <button
                onClick={() => setConfirmandoFechar(false)}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
