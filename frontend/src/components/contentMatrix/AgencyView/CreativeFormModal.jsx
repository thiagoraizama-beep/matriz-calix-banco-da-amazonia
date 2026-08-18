import { useEffect, useRef, useState } from "react";
import { createMatrixCreative, updateMatrixCreative, getCampanhas } from "../../../api/client.js";
import SearchSelect from "../../layout/SearchSelect.jsx";
import RangeCalendarPicker from "../../layout/RangeCalendarPicker.jsx";

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

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
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

  const [campanhaOptions, setCampanhaOptions] = useState([]);
  const [veiculoOptions, setVeiculoOptions] = useState([]);
  const [campanhaData, setCampanhaData] = useState([]);
  const [plataformasVeiculo, setPlataformasVeiculo] = useState([]);
  const [campanhaVeiculoId, setCampanhaVeiculoId] = useState(creative?.campanha_veiculo_id || null);

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


  function validarCamposObrigatorios() {
    if (impulsionado) {
      if (!linkPostagem.trim()) return "Preencha o link da postagem impulsionada";
    } else if (!isEdit && !file && !creative?.cloudinary_url) {
      return "Selecione um arquivo de imagem ou vídeo";
    }
    if (!campanha) return "Selecione a campanha";
    if (!veiculo) return "Selecione o veículo";
    if (!plataforma) return "Selecione a plataforma";
    if (!tipoCompra) return "Selecione o tipo de compra";
    if (!nome.trim()) return "Preencha o nome do criativo";
    if (!adName.trim()) return "Preencha o Ad Name";
    if (!formato) return "Selecione o formato";
    if (!periodoInicio || !periodoFim) return "Preencha o período de veiculação";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const erroValidacao = validarCamposObrigatorios();
    if (erroValidacao) { setError(erroValidacao); return; }
    setSaving(true);
    const urlDestinoNormalizada = urlDestino.trim() && !/^https?:\/\//i.test(urlDestino.trim())
      ? `https://${urlDestino.trim()}`
      : urlDestino.trim();
    try {
      if (isEdit) {
        const fd = new FormData();
        if (file) fd.append("file", file);
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
        await updateMatrixCreative(creative.id, fd);
      } else {
        const fd = new FormData();
        if (file) fd.append("file", file);
        if (!file && creative?.cloudinary_url) {
          fd.append("cloudinaryUrl", creative.cloudinary_url);
          fd.append("cloudinaryPublicId", creative.cloudinary_public_id);
          fd.append("tipoMidia", creative.tipo_midia);
        }
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

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-secondary)", lineHeight: 1 }}>×</button>
        </div>

        {/* Impulsionado / Darkpost -- decide o que aparece no campo seguinte:
            Impulsionado pede o link do post ja publicado, Dark Post exige upload
            de arquivo (nao existe como post organico). */}
        <Field label="Tipo de publicação">
          <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
            {[{ label: "Impulsionado", val: true }, { label: "Dark Post", val: false }].map(({ label, val }) => (
              <label key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="impulsionado"
                  checked={impulsionado === val}
                  onChange={() => setImpulsionado(val)}
                />
                {label}
              </label>
            ))}
          </div>
        </Field>

        {impulsionado && (
          <Field label="Link da postagem *">
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
        <Field label={impulsionado ? "Arquivo (opcional, para preview)" : isEdit ? "Arquivo (imagem ou vídeo)" : "Arquivo (imagem ou vídeo) *"}>
          {preview && (
            <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", maxHeight: 140, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--border)" }}>
              {(file ? file.type?.startsWith("video") : creative?.tipo_midia === "video") ? (
                <video src={preview} style={{ maxHeight: 140, maxWidth: "100%" }} controls />
              ) : (
                <img src={preview} alt="preview" style={{ maxHeight: 140, maxWidth: "100%", objectFit: "contain" }} />
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
            >
              {isEdit ? "Trocar arquivo" : "Escolher arquivo"}
            </button>
            {file && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        <Field label="Campanha *">
          <SearchSelect
            value={campanha}
            onChange={handleCampanhaChange}
            options={campanhaOptions}
            placeholder="Selecione a campanha..."
            allowFreeText
          />
        </Field>

        {/* Veículo — carregado a partir da campanha */}
        <Field label="Veículo *">
          <SearchSelect
            value={veiculo}
            onChange={handleVeiculoChange}
            options={veiculoOptions}
            placeholder={campanha ? "Selecione o veículo..." : "Selecione a campanha primeiro"}
            allowFreeText
          />
          {plataformasVeiculo.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Plataforma *</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {plataformasVeiculo.map((p) => {
                  const sel = plataforma === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlataforma(sel ? "" : p)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        border: "1px solid",
                        borderColor: sel ? "var(--accent)" : "var(--border)",
                        background: sel ? "var(--accent)" : "transparent",
                        color: sel ? "#fff" : "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: sel ? 700 : 400,
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

        {/* Tipo de compra — seleção única */}
        <Field label="Tipo de compra">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            {TIPOS_COMPRA_OPTIONS.map((t) => {
              const sel = tipoCompra === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoCompra(sel ? "" : t)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: sel ? "var(--accent)" : "var(--border)",
                    background: sel ? "var(--accent)" : "transparent",
                    color: sel ? "#fff" : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: sel ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Performance -- independente do tipo de publicacao (Impulsionado ou Dark
            Post). Quando marcado, o card na Matriz mostra uma barra comparando o
            orcamento projetado aqui com o investimento real vindo da planilha
            (coluna Cost). */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
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

        {/* Nome do criativo */}
        <Field label="Nome do criativo *">
          <input value={nome} onChange={(e) => setNome(e.target.value)} required style={inputStyle} />
        </Field>

        {/* Campaign Name (técnico) */}
        <Field label="Campaign Name">
          <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} style={inputStyle} placeholder="Ex: BR_CAMPANHA-INSTITUCIONAL-2026_CPM" />
        </Field>

        {/* Conjunto / Ad Group */}
        <Field label="Ad Group">
          <input value={conjunto} onChange={(e) => setConjunto(e.target.value)} style={inputStyle} />
        </Field>

        {/* Ad Name */}
        <Field label="Ad Name *">
          <textarea
            value={adName}
            onChange={(e) => setAdName(e.target.value.replace(/\n/g, ""))}
            placeholder="Deve bater exatamente com o Ad Name da planilha"
            rows={2}
            style={{ ...textareaStyle, resize: "none" }}
          />
        </Field>

        {/* Formato */}
        <Field label="Formato">
          <SearchSelect
            value={formato}
            onChange={(v) => setFormato(v || "")}
            options={TODOS_FORMATOS}
            placeholder="Stories, Reels, Feed..."
            allowFreeText
          />
        </Field>

        {/* Período */}
        <Field label="Período de veiculação">
          <RangeCalendarPicker
            start={periodoInicio}
            end={periodoFim}
            onChange={(s, en) => { setPeriodoInicio(s); setPeriodoFim(en); }}
          />
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

        {/* Descrição */}
        <Field label="Descricao">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} style={textareaStyle} />
        </Field>

        {/* Observações */}
        <Field label="Observacoes">
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} style={textareaStyle} />
        </Field>

        {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{ padding: "10px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : creative?._duplicate ? "Criar cópia" : "Criar criativo"}
        </button>
      </form>
    </div>
  );
}
