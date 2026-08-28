import { useEffect, useRef, useState } from "react";
import {
  getCampanhas, getRegisteredVehicles, getPlataformas, updateMatrixCreative,
} from "../../../api/client.js";
import SearchSelect from "../../layout/SearchSelect.jsx";
import MultiSearchSelect from "../../layout/MultiSearchSelect.jsx";
import SimpleDateRangeFields from "../../layout/SimpleDateRangeFields.jsx";
import StatusBadge, { STATUS_OPTIONS_AGENCIA } from "../statusBadge.jsx";

const TODOS_FORMATOS = [
  "Performance Max", "Search",
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

function SimpleSelect({ value, onChange, options, placeholder = "Selecione..." }) {
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
          cursor: "pointer", boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: 13, color: value ? "var(--text-primary)" : "var(--text-secondary)" }}>{value || placeholder}</span>
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
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                padding: "8px 10px", borderRadius: 7, cursor: "pointer", fontSize: 13,
                color: "var(--text-primary)",
                background: opt === value ? "var(--accent-soft)" : "transparent",
              }}
              onMouseEnter={(e) => { if (opt !== value) e.currentTarget.style.background = "var(--bg)"; }}
              onMouseLeave={(e) => { if (opt !== value) e.currentTarget.style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// periodo_inicio/periodo_fim chegam do backend como Date (objeto) OU string
// ISO completa, dependendo do caminho de serializacao -- normaliza pros 10
// primeiros chars (YYYY-MM-DD), formato que SimpleDateRangeFields espera.
function dataYMD(valor) {
  if (!valor) return "";
  const iso = valor instanceof Date ? valor.toISOString() : String(valor);
  return iso.slice(0, 10);
}

// Lista de campos editaveis -- define o menu lateral e, pra cada campo, como
// ler o valor atual de um creative bruto (raw, snake_case do banco) pra
// detectar se os selecionados ja divergem entre si.
const CAMPOS = [
  { key: "status", label: "Status", getValor: (c) => c.status || "" },
  { key: "campanha", label: "Campanha", getValor: (c) => c.campanha || "" },
  { key: "veiculo", label: "Veículo", getValor: (c) => c.veiculo || "" },
  { key: "plataforma", label: "Plataforma", getValor: (c) => c.plataforma || "" },
  { key: "tipoCompra", label: "Tipo de compra", getValor: (c) => c.tipos_compra?.[0] || "" },
  { key: "formularioNativo", label: "Formulário de captura", getValor: (c) => (c.formulario_nativo ? "Nativo da plataforma" : "Site/LP externa"), soSe: (c) => c.tipos_compra?.includes("CPL") },
  { key: "formato", label: "Formato", getValor: (c) => (Array.isArray(c.formato) ? c.formato.join(", ") : "") },
  { key: "campaignName", label: "Campaign Name", getValor: (c) => c.campaign_name || "" },
  { key: "conjunto", label: "Ad Group", getValor: (c) => c.conjunto || "" },
  { key: "urlDestino", label: "URL de destino", getValor: (c) => c.url_destino || "" },
  { key: "impulsionado", label: "Tipo de publicação", getValor: (c) => (c.impulsionado ? "Impulsionado" : "Dark Post") },
  { key: "titulo", label: "Título", getValor: (c) => c.titulo || "" },
  // periodo_inicio/periodo_fim chegam como timestamp ISO completo (ex:
  // "2026-08-28T03:00:00.000Z") -- so os 10 primeiros chars (YYYY-MM-DD)
  // interessam, mesma normalizacao do formulario individual (CreativeFormModal.jsx).
  { key: "periodo", label: "Período de veiculação", getValor: (c) => `${dataYMD(c.periodo_inicio)} - ${dataYMD(c.periodo_fim)}` },
  { key: "segmentacao", label: "Segmentação", getValor: (c) => c.segmentacao || "" },
  { key: "descricao", label: "Descrição", getValor: (c) => c.descricao || "" },
  { key: "observacoes", label: "Observações", getValor: (c) => c.observacoes || "" },
  { key: "ehPerformance", label: "Performance", getValor: (c) => (c.eh_performance ? "Sim" : "Não") },
  { key: "orcamentoProjetado", label: "Orçamento projetado", getValor: (c) => (c.orcamento_projetado ? String(c.orcamento_projetado) : ""), soSe: (c) => c.eh_performance },
  { key: "nome", label: "Nome", getValor: (c) => c.nome || "", confirmarEmMassa: true },
  { key: "adName", label: "Ad Name", getValor: (c) => c.ad_name || "", confirmarEmMassa: true },
  { key: "posicionamento", label: "Posicionamento", getValor: (c) => c.posicionamento || "" },
  { key: "linkPostagem", label: "Link da postagem", getValor: (c) => c.link_postagem || "" },
  { key: "searchTitulos", label: "Títulos (Search)", getValor: (c) => (c.search_campos?.titulo || []).join(" | "), soSe: (c) => c.formato?.includes("Search") },
  { key: "searchTitulosLongos", label: "Títulos longos (Search)", getValor: (c) => (c.search_campos?.tituloLongo || []).join(" | "), soSe: (c) => c.formato?.includes("Search") },
  { key: "searchTextos", label: "Descrições (Search)", getValor: (c) => (c.search_campos?.texto || []).join(" | "), soSe: (c) => c.formato?.includes("Search") },
  { key: "searchPalavrasChave", label: "Palavras-chave (Search)", getValor: (c) => c.search_campos?.palavrasChave || "", soSe: (c) => c.formato?.includes("Search") },
];

// Campos cujo valor "achatado" (getValor) precisa ser reconvertido pra um
// formato diferente antes de ir pro FormData -- os demais campos vao como
// string simples (o padrao coberto pelo "default" abaixo).
function valorParaFormData(fd, campoKey, valor) {
  switch (campoKey) {
    case "tipoCompra":
      fd.append("tiposCompra", JSON.stringify(valor ? [valor] : []));
      break;
    case "formularioNativo":
      fd.append("formularioNativo", String(valor === "Nativo da plataforma"));
      break;
    case "formato":
      fd.append("formato", JSON.stringify(valor ? valor.split(", ").filter(Boolean) : []));
      break;
    case "impulsionado":
      fd.append("impulsionado", String(valor === "Impulsionado"));
      break;
    case "ehPerformance":
      fd.append("ehPerformance", String(valor === "Sim"));
      break;
    case "orcamentoProjetado":
      // valor ja vem em reais (nao centavos) do controle de moeda.
      fd.append("orcamentoProjetado", valor || "0");
      break;
    case "searchTitulos":
      fd.append("searchCampos", JSON.stringify({ titulo: valor ? valor.split(" | ").filter(Boolean) : [] }));
      break;
    case "searchTitulosLongos":
      fd.append("searchCampos", JSON.stringify({ tituloLongo: valor ? valor.split(" | ").filter(Boolean) : [] }));
      break;
    case "searchTextos":
      fd.append("searchCampos", JSON.stringify({ texto: valor ? valor.split(" | ").filter(Boolean) : [] }));
      break;
    case "searchPalavrasChave":
      fd.append("searchCampos", JSON.stringify({ palavrasChave: valor }));
      break;
    default:
      fd.append(campoKey, valor);
  }
}

export default function BulkEditModal({ creatives, onClose, onSaved }) {
  const [campoAtivo, setCampoAtivo] = useState(null);

  // Unica fonte de verdade: valor atual (editavel) de cada campo, por
  // criativo -- { [campoKey]: { [creativeId]: valor } }. Inicia vazio, e
  // cada painel de campo se auto-preenche com o valor real de cada criativo
  // na primeira vez que e aberto (ver useEffect abaixo).
  const [valores, setValores] = useState({});
  // Quais criativos tiveram o valor de fato TOCADO (mudado) num campo --
  // so esses entram no salvamento; abrir o painel e nao mexer em nada nao
  // deve reescrever tudo com o mesmo valor que ja estava.
  const [tocado, setTocado] = useState({});
  const [aplicarATodosValor, setAplicarATodosValor] = useState({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [confirmandoCampo, setConfirmandoCampo] = useState(null);

  const [campanhasOptions, setCampanhasOptions] = useState([]);
  const [veiculosOptions, setVeiculosOptions] = useState([]);
  const [plataformasOptions, setPlataformasOptions] = useState([]);

  useEffect(() => {
    getCampanhas().then((rows) => setCampanhasOptions(rows.map((c) => c.nome))).catch(() => {});
    getRegisteredVehicles().then((rows) => setVeiculosOptions(rows.map((v) => v.nome))).catch(() => {});
    getPlataformas().then((rows) => setPlataformasOptions(rows.map((p) => p.nome))).catch(() => {});
  }, []);

  // Campos visiveis no menu -- "soSe" filtra Formulario de captura/Search
  // pra so aparecer quando fizer sentido pro conjunto selecionado.
  const camposVisiveis = CAMPOS.filter((c) => !c.soSe || creatives.some(c.soSe));

  function valoresDoCampo(campoKey) {
    const campo = CAMPOS.find((c) => c.key === campoKey);
    if (!campo) return [];
    return creatives.map((c) => campo.getValor(c));
  }
  function divergente(campoKey) {
    return new Set(valoresDoCampo(campoKey)).size > 1;
  }

  // Ao abrir um campo pela 1a vez, pre-preenche "valores" com o que cada
  // criativo ja tem hoje -- assim a lista individual sempre mostra algo
  // coerente, mesmo antes do usuario mexer em qualquer linha.
  useEffect(() => {
    if (!campoAtivo || valores[campoAtivo]) return;
    const campo = CAMPOS.find((c) => c.key === campoAtivo);
    const inicial = {};
    for (const c of creatives) inicial[c.id] = campo.getValor(c);
    setValores((prev) => ({ ...prev, [campoAtivo]: inicial }));
  }, [campoAtivo]);

  function setValorLinha(campoKey, creativeId, valor) {
    setValores((prev) => ({ ...prev, [campoKey]: { ...(prev[campoKey] || {}), [creativeId]: valor } }));
    setTocado((prev) => ({ ...prev, [campoKey]: { ...(prev[campoKey] || {}), [creativeId]: true } }));
  }
  // Campo "aplicar a todos" no topo -- preenche todas as linhas de baixo de
  // uma vez; o usuario ainda pode ajustar uma linha especifica depois.
  function aplicarATodos(campoKey, valor) {
    setAplicarATodosValor((prev) => ({ ...prev, [campoKey]: valor }));
    const novoValores = {};
    const novoTocado = {};
    for (const c of creatives) { novoValores[c.id] = valor; novoTocado[c.id] = true; }
    setValores((prev) => ({ ...prev, [campoKey]: novoValores }));
    setTocado((prev) => ({ ...prev, [campoKey]: novoTocado }));
  }

  const algumCampoTocado = Object.values(tocado).some((porId) => Object.values(porId).some(Boolean));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!algumCampoTocado) {
      setError("Altere ao menos um campo para aplicar");
      return;
    }

    // Nome/Ad Name aplicados a TODOS os selecionados com o mesmo valor
    // (via "aplicar a todos") arriscam duplicar -- pede confirmacao extra
    // uma unica vez antes de seguir com o salvamento de fato.
    for (const campo of CAMPOS) {
      if (!campo.confirmarEmMassa) continue;
      const porId = tocado[campo.key] || {};
      const idsTocados = Object.keys(porId).filter((id) => porId[id]);
      if (idsTocados.length < 2) continue;
      const valoresTocados = idsTocados.map((id) => valores[campo.key][id]);
      const mesmoValor = new Set(valoresTocados).size === 1;
      if (mesmoValor && confirmandoCampo !== campo.key) {
        setConfirmandoCampo(campo.key);
        setCampoAtivo(campo.key);
        setError(`Tem certeza? "${campo.label}" ficará igual em ${idsTocados.length} criativos. Clique em "Aplicar" novamente para confirmar.`);
        return;
      }
    }
    setConfirmandoCampo(null);

    setSaving(true);
    try {
      const atualizados = [];
      const falharam = [];

      for (const campoKey of Object.keys(tocado)) {
        const porId = tocado[campoKey] || {};
        for (const c of creatives) {
          if (!porId[c.id]) continue;
          const valor = valores[campoKey]?.[c.id] ?? "";
          try {
            const fd = new FormData();
            valorParaFormData(fd, campoKey, valor);
            await updateMatrixCreative(c.id, fd);
            if (!atualizados.includes(c.id)) atualizados.push(c.id);
          } catch {
            if (!falharam.some((f) => f.id === c.id)) falharam.push({ id: c.id, motivo: "Falha ao salvar" });
          }
        }
      }

      setResultado({ atualizados, falharam, operationId: null });
      if (falharam.length === 0) onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Falha ao aplicar edição em massa");
    } finally {
      setSaving(false);
    }
  }

  // Painel do campo selecionado: campo "aplicar a todos" sempre no topo +
  // lista com o valor atual de cada criativo, sempre visivel e editavel.
  function renderPainelCampo(campoKey) {
    const campo = CAMPOS.find((c) => c.key === campoKey);
    const diverge = divergente(campoKey);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <strong style={{ fontSize: 15, fontWeight: 700 }}>{campo.label}</strong>
          {diverge && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--warn, #b45309)", fontWeight: 600 }}>
              Valores diferentes entre os selecionados: {[...new Set(valoresDoCampo(campoKey))].filter(Boolean).join(", ") || "vazio"}
            </p>
          )}
        </div>

        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Aplicar a todos de uma vez
          </label>
          {renderControle(campoKey, aplicarATodosValor[campoKey] ?? "", (v) => aplicarATodos(campoKey, v))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Valor individual por criativo
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {creatives.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--bg)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--card-bg)" }}>
                  {c.cloudinary_url && (
                    c.tipo_midia === "video" ? (
                      <video src={c.cloudinary_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <img src={c.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )
                  )}
                </div>
                <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.titulo || c.nome || `Criativo #${c.id}`}
                </span>
                <div style={{ width: campoKey === "periodo" ? 340 : 240, flexShrink: 0 }}>
                  {renderControle(campoKey, valores[campoKey]?.[c.id] ?? "", (v) => setValorLinha(campoKey, c.id, v))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Controle unico por campo -- usado tanto na linha "aplicar a todos"
  // quanto em cada linha individual, so muda o value/onChange recebido.
  function renderControle(campoKey, valor, onChange) {
    switch (campoKey) {
      case "status":
        return <StatusSelect value={valor} onChange={onChange} options={STATUS_OPTIONS_AGENCIA} />;
      case "campanha":
        return <SearchSelect value={valor} onChange={(v) => onChange(v || "")} options={campanhasOptions} placeholder="Nome da campanha" />;
      case "veiculo":
        return <SearchSelect value={valor} onChange={(v) => onChange(v || "")} options={veiculosOptions} placeholder="Nome do veículo" />;
      case "plataforma":
        return <SearchSelect value={valor} onChange={(v) => onChange(v || "")} options={plataformasOptions} placeholder="Nome da plataforma" />;
      case "tipoCompra":
        return <SimpleSelect value={valor} onChange={onChange} options={TIPOS_COMPRA_OPTIONS} />;
      case "formularioNativo":
        return <SimpleSelect value={valor} onChange={onChange} options={["Site/LP externa", "Nativo da plataforma"]} />;
      case "formato":
        return (
          <MultiSearchSelect
            value={valor ? valor.split(", ").filter(Boolean) : []}
            onChange={(novos) => {
              if (novos.includes("Performance Max")) { onChange(novos.join(", ")); return; }
              onChange((novos.length ? [novos[novos.length - 1]] : []).join(", "));
            }}
            options={TODOS_FORMATOS}
            placeholder="Buscar formato: Search, Stories, Reels..."
          />
        );
      case "impulsionado":
        return <SimpleSelect value={valor} onChange={onChange} options={["Impulsionado", "Dark Post"]} />;
      case "periodo": {
        const [ini = "", fim = ""] = (valor || "").split(" - ");
        return <SimpleDateRangeFields start={ini} end={fim} onChange={(s, en) => onChange(`${s} - ${en}`)} />;
      }
      case "ehPerformance":
        return <SimpleSelect value={valor} onChange={onChange} options={["Sim", "Não"]} />;
      case "orcamentoProjetado": {
        const centavos = Math.round(Number(valor || 0) * 100);
        return (
          <input
            type="text"
            inputMode="numeric"
            value={(centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            onChange={(e) => {
              const digitos = e.target.value.replace(/\D/g, "");
              onChange(digitos ? (Number(digitos) / 100).toFixed(2) : "0");
            }}
            style={inputStyle}
          />
        );
      }
      case "segmentacao":
      case "descricao":
      case "observacoes":
        return <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={2} style={textareaStyle} />;
      default:
        return <input value={valor} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
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
          width: 820, maxWidth: "95vw", height: 600, maxHeight: "85vh", display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 18, boxShadow: "0 24px 60px rgba(10,16,32,0.35)", overflow: "hidden",
          animation: "bulkEditModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "20px 24px 14px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <strong style={{ fontSize: 17, fontWeight: 700 }}>Editar em massa</strong>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
              {creatives.length} criativo{creatives.length !== 1 ? "s" : ""} selecionado{creatives.length !== 1 ? "s" : ""} — escolha um campo ao lado
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

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <nav style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--border)", padding: "12px 10px", overflowY: "auto" }}>
            {camposVisiveis.map((campo) => {
              const ativo = campoAtivo === campo.key;
              const campoTocado = Object.values(tocado[campo.key] || {}).some(Boolean);
              const diverge = divergente(campo.key);
              return (
                <div
                  key={campo.key}
                  onClick={() => setCampoAtivo(campo.key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 2,
                    color: ativo ? "var(--accent)" : "var(--text-secondary)",
                    background: ativo ? "var(--accent-soft)" : "transparent",
                    fontWeight: ativo ? 600 : 400, fontSize: 13,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{campo.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {diverge && (
                      <span title="Valores diferentes entre os selecionados" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warn, #b45309)" }} />
                    )}
                    {campoTocado && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                    )}
                  </span>
                </div>
              );
            })}
          </nav>

          <div key={campoAtivo} style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: 24, animation: "bulkEditPainelIn 0.15s ease-out" }}>
            {campoAtivo ? renderPainelCampo(campoAtivo) : (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Escolha um campo na lista ao lado para editar.</p>
            )}
          </div>
        </div>

        <div style={{ padding: "0 24px" }}>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(220,38,38,0.1)", color: "var(--danger)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginTop: 14 }}>
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
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginTop: 14,
                background: resultado.falharam.length > 0 ? "rgba(220,38,38,0.1)" : "var(--accent-soft)",
                color: resultado.falharam.length > 0 ? "var(--danger)" : "var(--accent)",
              }}
            >
              <span>
                {`${resultado.atualizados.length} criativo(s) atualizado(s)${resultado.falharam.length > 0 ? `, ${resultado.falharam.length} falharam` : ""}. Para desfazer, use o painel "Últimas edições".`}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 24px", borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer", transition: "background 0.15s ease" }}
          >
            {resultado && resultado.falharam.length === 0 ? "Fechar" : "Cancelar"}
          </button>
          <button
            type="submit"
            disabled={saving || !algumCampoTocado}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: saving || !algumCampoTocado ? "default" : "pointer",
              opacity: saving || !algumCampoTocado ? 0.6 : 1, transition: "opacity 0.15s ease",
            }}
          >
            {saving ? "Aplicando..." : `Aplicar a ${creatives.length} criativo(s)`}
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
        @keyframes bulkEditPainelIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
