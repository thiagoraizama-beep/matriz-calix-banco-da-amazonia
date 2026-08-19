import { useEffect, useRef, useState } from "react";
import { bulkUpdateCreatives, getCampanhas, getRegisteredVehicles } from "../../../api/client.js";
import SearchSelect from "../../layout/SearchSelect.jsx";
import SimpleDateRangeFields from "../../layout/SimpleDateRangeFields.jsx";
import StatusBadge, { STATUS_OPTIONS_AGENCIA } from "../statusBadge.jsx";

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
    <div
      style={{
        opacity: aplicar ? 1 : 0.55, padding: 12, borderRadius: 10,
        border: `1px solid ${aplicar ? "var(--accent-soft)" : "var(--border)"}`,
        background: aplicar ? "var(--accent-soft)" : "transparent",
        transition: "opacity 0.15s ease, border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: aplicar ? "var(--accent)" : "var(--text-secondary)", marginBottom: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={aplicar} onChange={onToggleAplicar} />
        {label}
      </label>
      <div style={{ pointerEvents: aplicar ? "auto" : "none" }}>{children}</div>
    </div>
  );
}

// Dropdown de status com o mesmo badge colorido usado no card/StatusPopover,
// em vez do <select> nativo do navegador (sem cor, inconsistente com o resto).
function StatusSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)",
          cursor: "pointer",
        }}
      >
        {value ? <StatusBadge status={value} /> : <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Selecione...</span>}
        <span style={{ fontSize: 10, color: "var(--text-secondary)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(20,33,61,0.15)", padding: 6, maxHeight: 260, overflowY: "auto",
          }}
        >
          {options.map((s) => (
            <div
              key={s}
              onClick={() => { onChange(s); setOpen(false); }}
              style={{
                padding: "8px 10px", borderRadius: 7, cursor: "pointer",
                background: s === value ? "var(--accent-soft)" : "transparent",
              }}
              onMouseEnter={(e) => { if (s !== value) e.currentTarget.style.background = "var(--bg)"; }}
              onMouseLeave={(e) => { if (s !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <StatusBadge status={s} />
            </div>
          ))}
        </div>
      )}
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

  // Opcoes reais de Campanha/Veiculo pro SearchSelect -- antes ficavam vazias
  // (options={[]}), entao na pratica nao dava pra escolher nada nesses dois campos.
  const [campanhasOptions, setCampanhasOptions] = useState([]);
  const [veiculosOptions, setVeiculosOptions] = useState([]);

  useEffect(() => {
    getCampanhas().then((rows) => setCampanhasOptions(rows.map((c) => c.nome))).catch(() => {});
    getRegisteredVehicles().then((rows) => setVeiculosOptions(rows.map((v) => v.nome))).catch(() => {});
  }, []);

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
      style={{
        position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
        animation: "bulkEditOverlayIn 0.15s ease-out",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: 640, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18,
          background: "var(--card-bg)", borderRadius: 18, boxShadow: "0 24px 60px rgba(10,16,32,0.35)", padding: 24,
          animation: "bulkEditModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <strong style={{ fontSize: 17, fontWeight: 700 }}>Editar em massa</strong>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
              {ids.length} criativo{ids.length !== 1 ? "s" : ""} selecionado{ids.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%",
              border: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p style={{ margin: "-8px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
          Marque os campos que deseja alterar. Só os campos marcados serão aplicados a todos os criativos
          selecionados — os demais permanecem como estão em cada um.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <CampoEmMassa label="Status" aplicar={!!aplicar.status} onToggleAplicar={() => toggle("status")}>
            <StatusSelect value={status} onChange={setStatus} options={STATUS_OPTIONS_AGENCIA} />
          </CampoEmMassa>

          <CampoEmMassa label="Campanha" aplicar={!!aplicar.campanha} onToggleAplicar={() => toggle("campanha")}>
            <SearchSelect value={campanha} onChange={(v) => setCampanha(v || "")} options={campanhasOptions} placeholder="Nome da campanha" />
          </CampoEmMassa>

          <CampoEmMassa label="Veículo" aplicar={!!aplicar.veiculo} onToggleAplicar={() => toggle("veiculo")}>
            <SearchSelect value={veiculo} onChange={(v) => setVeiculo(v || "")} options={veiculosOptions} placeholder="Nome do veículo" />
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
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600,
              background: resultado.falharam.length > 0 ? "rgba(220,38,38,0.1)" : "var(--accent-soft)",
              color: resultado.falharam.length > 0 ? "var(--danger)" : "var(--accent)",
            }}
          >
            {resultado.atualizados.length} criativo(s) atualizado(s)
            {resultado.falharam.length > 0 && `, ${resultado.falharam.length} falharam`}.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer", transition: "background 0.15s ease" }}
          >
            {resultado && resultado.falharam.length === 0 ? "Fechar" : "Cancelar"}
          </button>
          <button
            type="submit"
            disabled={saving || nenhumCampoMarcado}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: saving || nenhumCampoMarcado ? "default" : "pointer",
              opacity: saving || nenhumCampoMarcado ? 0.6 : 1, transition: "opacity 0.15s ease",
            }}
          >
            {saving ? "Aplicando..." : `Aplicar a ${ids.length} criativo(s)`}
          </button>
        </div>
      </form>
      <style>{`
        @keyframes bulkEditOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bulkEditModalIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
