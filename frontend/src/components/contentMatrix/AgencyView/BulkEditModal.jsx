import { useState } from "react";
import { bulkUpdateCreatives } from "../../../api/client.js";
import SearchSelect from "../../layout/SearchSelect.jsx";
import SimpleDateRangeFields from "../../layout/SimpleDateRangeFields.jsx";
import { STATUS_OPTIONS_AGENCIA } from "../statusBadge.jsx";

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

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" };
const textareaStyle = { ...inputStyle, fontFamily: "inherit", resize: "vertical" };

// Linha de campo com checkbox "Aplicar" -- so campos marcados entram no patch
// enviado ao backend, os demais ficam como estao em cada criativo selecionado.
// Isso evita sobrescrever tudo por engano quando o usuario so quer mudar 1 ou 2
// campos entre varios criativos diferentes.
function CampoEmMassa({ label, aplicar, onToggleAplicar, children }) {
  return (
    <div style={{ opacity: aplicar ? 1 : 0.55 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", marginBottom: 5, cursor: "pointer" }}>
        <input type="checkbox" checked={aplicar} onChange={onToggleAplicar} />
        {label}
      </label>
      <div style={{ pointerEvents: aplicar ? "auto" : "none" }}>{children}</div>
    </div>
  );
}

export default function BulkEditModal({ ids, onClose, onSaved }) {
  const [aplicar, setAplicar] = useState({});
  const [status, setStatus] = useState("");
  const [campanha, setCampanha] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [plataforma, setPlataforma] = useState("");
  const [tipoCompra, setTipoCompra] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [conjunto, setConjunto] = useState("");
  const [formato, setFormato] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [urlDestino, setUrlDestino] = useState("");
  const [impulsionado, setImpulsionado] = useState(true);
  const [segmentacao, setSegmentacao] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ehPerformance, setEhPerformance] = useState(false);
  const [orcamentoCentavos, setOrcamentoCentavos] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  function toggle(key) {
    setAplicar((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const nenhumCampoMarcado = Object.values(aplicar).every((v) => !v);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (nenhumCampoMarcado) {
      setError("Marque ao menos um campo para aplicar");
      return;
    }
    if (aplicar.periodo && periodoInicio && periodoFim && periodoInicio > periodoFim) {
      setError("A data inicial não pode ser depois da data final");
      return;
    }

    const patch = {};
    if (aplicar.status) patch.status = status;
    if (aplicar.campanha) patch.campanha = campanha;
    if (aplicar.veiculo) patch.veiculo = veiculo;
    if (aplicar.plataforma) patch.plataforma = plataforma;
    if (aplicar.tipoCompra) patch.tiposCompra = tipoCompra ? [tipoCompra] : [];
    if (aplicar.campaignName) patch.campaignName = campaignName;
    if (aplicar.conjunto) patch.conjunto = conjunto;
    if (aplicar.formato) patch.formato = formato;
    if (aplicar.periodo) { patch.periodoInicio = periodoInicio; patch.periodoFim = periodoFim; }
    if (aplicar.urlDestino) patch.urlDestino = urlDestino;
    if (aplicar.impulsionado) patch.impulsionado = String(impulsionado);
    if (aplicar.segmentacao) patch.segmentacao = segmentacao;
    if (aplicar.titulo) patch.titulo = titulo;
    if (aplicar.descricao) patch.descricao = descricao;
    if (aplicar.observacoes) patch.observacoes = observacoes;
    if (aplicar.ehPerformance) {
      patch.ehPerformance = String(ehPerformance);
      if (ehPerformance) patch.orcamentoProjetado = String(orcamentoCentavos / 100);
    }

    setSaving(true);
    try {
      const res = await bulkUpdateCreatives(ids, patch);
      setResultado(res);
      if (res.falharam.length === 0) {
        onSaved();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Falha ao aplicar edição em massa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="card"
        style={{ width: 640, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 16 }}>Editar {ids.length} criativo(s) em massa</strong>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)" }}>×</button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
          Marque os campos que deseja alterar. Só os campos marcados serão aplicados a todos os criativos
          selecionados — os demais permanecem como estão em cada um.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <CampoEmMassa label="Status" aplicar={!!aplicar.status} onToggleAplicar={() => toggle("status")}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              <option value="">Selecione...</option>
              {STATUS_OPTIONS_AGENCIA.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </CampoEmMassa>

          <CampoEmMassa label="Campanha" aplicar={!!aplicar.campanha} onToggleAplicar={() => toggle("campanha")}>
            <SearchSelect value={campanha} onChange={(v) => setCampanha(v || "")} options={[]} placeholder="Nome da campanha" />
          </CampoEmMassa>

          <CampoEmMassa label="Veículo" aplicar={!!aplicar.veiculo} onToggleAplicar={() => toggle("veiculo")}>
            <SearchSelect value={veiculo} onChange={(v) => setVeiculo(v || "")} options={[]} placeholder="Nome do veículo" />
          </CampoEmMassa>

          <CampoEmMassa label="Plataforma" aplicar={!!aplicar.plataforma} onToggleAplicar={() => toggle("plataforma")}>
            <input value={plataforma} onChange={(e) => setPlataforma(e.target.value)} style={inputStyle} />
          </CampoEmMassa>

          <CampoEmMassa label="Tipo de compra" aplicar={!!aplicar.tipoCompra} onToggleAplicar={() => toggle("tipoCompra")}>
            <select value={tipoCompra} onChange={(e) => setTipoCompra(e.target.value)} style={inputStyle}>
              <option value="">Selecione...</option>
              {TIPOS_COMPRA_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </CampoEmMassa>

          <CampoEmMassa label="Formato" aplicar={!!aplicar.formato} onToggleAplicar={() => toggle("formato")}>
            <SearchSelect value={formato} onChange={(v) => setFormato(v || "")} options={TODOS_FORMATOS} placeholder="Stories, Reels, Feed..." />
          </CampoEmMassa>

          <CampoEmMassa label="Campaign Name" aplicar={!!aplicar.campaignName} onToggleAplicar={() => toggle("campaignName")}>
            <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} style={inputStyle} />
          </CampoEmMassa>

          <CampoEmMassa label="Ad Group" aplicar={!!aplicar.conjunto} onToggleAplicar={() => toggle("conjunto")}>
            <input value={conjunto} onChange={(e) => setConjunto(e.target.value)} style={inputStyle} />
          </CampoEmMassa>

          <CampoEmMassa label="URL de destino" aplicar={!!aplicar.urlDestino} onToggleAplicar={() => toggle("urlDestino")}>
            <input value={urlDestino} onChange={(e) => setUrlDestino(e.target.value)} style={inputStyle} placeholder="https://" />
          </CampoEmMassa>

          <CampoEmMassa label="Tipo de publicação" aplicar={!!aplicar.impulsionado} onToggleAplicar={() => toggle("impulsionado")}>
            <div style={{ display: "flex", gap: 12, paddingTop: 6 }}>
              {[{ label: "Impulsionado", val: true }, { label: "Dark Post", val: false }].map(({ label, val }) => (
                <label key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" name="impulsionado-massa" checked={impulsionado === val} onChange={() => setImpulsionado(val)} />
                  {label}
                </label>
              ))}
            </div>
          </CampoEmMassa>

          <CampoEmMassa label="Título" aplicar={!!aplicar.titulo} onToggleAplicar={() => toggle("titulo")}>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={inputStyle} />
          </CampoEmMassa>

          <div style={{ gridColumn: "1 / -1" }}>
            <CampoEmMassa label="Período de veiculação" aplicar={!!aplicar.periodo} onToggleAplicar={() => toggle("periodo")}>
              <SimpleDateRangeFields start={periodoInicio} end={periodoFim} onChange={(s, en) => { setPeriodoInicio(s); setPeriodoFim(en); }} />
            </CampoEmMassa>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <CampoEmMassa label="Segmentação" aplicar={!!aplicar.segmentacao} onToggleAplicar={() => toggle("segmentacao")}>
              <textarea value={segmentacao} onChange={(e) => setSegmentacao(e.target.value)} rows={2} style={textareaStyle} />
            </CampoEmMassa>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <CampoEmMassa label="Descrição" aplicar={!!aplicar.descricao} onToggleAplicar={() => toggle("descricao")}>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} style={textareaStyle} />
            </CampoEmMassa>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <CampoEmMassa label="Observações" aplicar={!!aplicar.observacoes} onToggleAplicar={() => toggle("observacoes")}>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} style={textareaStyle} />
            </CampoEmMassa>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <CampoEmMassa label="Performance (aba Performance + orçamento projetado)" aplicar={!!aplicar.ehPerformance} onToggleAplicar={() => toggle("ehPerformance")}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={ehPerformance} onChange={(e) => setEhPerformance(e.target.checked)} />
                  Marcar como Performance
                </label>
                {ehPerformance && (
                  <div style={{ minWidth: 160 }}>
                    <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>Orçamento projetado</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={(orcamentoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, "");
                        setOrcamentoCentavos(digitos ? Number(digitos) : 0);
                      }}
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>
            </CampoEmMassa>
          </div>
        </div>

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

        {resultado && (
          <p style={{ fontSize: 12, color: resultado.falharam.length > 0 ? "var(--danger)" : "var(--success)", margin: 0 }}>
            {resultado.atualizados.length} criativo(s) atualizado(s)
            {resultado.falharam.length > 0 && `, ${resultado.falharam.length} falharam`}.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
          >
            {resultado && resultado.falharam.length === 0 ? "Fechar" : "Cancelar"}
          </button>
          <button
            type="submit"
            disabled={saving || nenhumCampoMarcado}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: saving || nenhumCampoMarcado ? "default" : "pointer",
              opacity: saving || nenhumCampoMarcado ? 0.6 : 1,
            }}
          >
            {saving ? "Aplicando..." : `Aplicar a ${ids.length} criativo(s)`}
          </button>
        </div>
      </form>
    </div>
  );
}
