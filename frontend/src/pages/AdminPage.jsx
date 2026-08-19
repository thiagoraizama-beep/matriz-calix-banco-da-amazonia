import { useEffect, useMemo, useState } from "react";
import {
  getLixeiraCreatives, getLixeiraCampanhas,
  restaurarCreativeLixeira, restaurarCampanhaLixeira,
  excluirCreativeDefinitivo, excluirCampanhaDefinitiva,
  getLixeiraHistorico, getUsuariosHistorico,
} from "../api/client.js";
import Spinner from "../components/common/Spinner.jsx";
import TrashIcon from "../components/common/TrashIcon.jsx";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";
import CreativeFusedDetailModal from "../components/contentMatrix/CreativeFusedDetailModal.jsx";
import Ga4IntegrationsManagement from "../components/profile/Ga4IntegrationsManagement.jsx";
import SheetIntegrationsManagement from "../components/profile/SheetIntegrationsManagement.jsx";

const TABS = [
  { id: "criativos", label: "Criativos excluídos" },
  { id: "campanhas", label: "Campanhas excluídas" },
  { id: "historico", label: "Histórico" },
  { id: "ga4", label: "Integrações GA4" },
  { id: "planilhas", label: "Integrações de Planilha" },
];

// Badge composta "Entidade + acao" (ex: "Campanha excluída", "Criativo
// criado") em vez de so a acao crua -- sozinha nao dizia o que foi
// criado/editado/excluido. Concordancia de genero: campanha/usuario sao
// femininas ("excluída"), criativo e masculino ("excluído").
const GENERO_ENTIDADE = { campanha: "f", criativo: "m", usuario: "m" };

const ACAO_PARTICIPIO = {
  criacao: { m: "criado", f: "criada" },
  edicao: { m: "editado", f: "editada" },
  status: { m: "com status alterado", f: "com status alterado" },
  exclusao: { m: "excluído", f: "excluída" },
  restauracao: { m: "restaurado", f: "restaurada" },
  exclusao_definitiva: { m: "excluído definitivamente", f: "excluída definitivamente" },
};

// promocao_admin/revogacao_admin nao seguem o padrao "Entidade + particípio"
// (nao fazem sentido como "Usuário promovido") -- tem frase propria.
const ACAO_LABEL_CUSTOM = {
  promocao_admin: "Promovido a administrador",
  revogacao_admin: "Administrador removido",
};

const ENTIDADE_LABEL = { campanha: "Campanha", criativo: "Criativo", usuario: "Usuário" };

function descricaoAcao(acao, entidadeTipo) {
  if (ACAO_LABEL_CUSTOM[acao]) return ACAO_LABEL_CUSTOM[acao];
  const genero = GENERO_ENTIDADE[entidadeTipo] || "m";
  const participio = ACAO_PARTICIPIO[acao]?.[genero] || acao;
  return `${ENTIDADE_LABEL[entidadeTipo] || entidadeTipo} ${participio}`;
}

// Paleta institucional (verde/terroso do banco) -- nunca vermelho/laranja/roxo
// generico aqui, mesmo para acoes "destrutivas", pra manter a identidade
// visual coerente com o resto do sistema. "neutro" (borda cinza) pra acoes
// que nao pedem destaque, como revogar admin.
const ACAO_ESTILO = {
  criacao: { badgeBg: "rgba(11,110,79,0.12)", badgeColor: "#0B6E4F", linha: "var(--accent)" },
  edicao: { badgeBg: "var(--accent-soft)", badgeColor: "var(--accent)", linha: "var(--accent)" },
  status: { badgeBg: "rgba(30,156,107,0.14)", badgeColor: "#1E9C6B", linha: "#1E9C6B" },
  exclusao: { badgeBg: "rgba(78,107,74,0.16)", badgeColor: "#4E6B4A", linha: "var(--border)" },
  restauracao: { badgeBg: "rgba(30,156,107,0.14)", badgeColor: "#1E9C6B", linha: "#1E9C6B" },
  exclusao_definitiva: { badgeBg: "rgba(0,61,42,0.12)", badgeColor: "#003D2A", linha: "var(--border)" },
  promocao_admin: { badgeBg: "rgba(11,110,79,0.12)", badgeColor: "#0B6E4F", linha: "var(--accent)" },
  revogacao_admin: { badgeBg: "rgba(78,107,74,0.16)", badgeColor: "#4E6B4A", linha: "var(--border)" },
};
const ESTILO_PADRAO = { badgeBg: "var(--border)", badgeColor: "var(--text-secondary)", linha: "var(--border)" };

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CAMPOS_MONETARIOS = new Set(["Orçamento projetado"]);
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_DATA_JS_TOSTRING = /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}/;

function formatValorCampo(valor, campo) {
  if (!valor) return valor;
  if (CAMPOS_MONETARIOS.has(campo)) {
    const num = Number(String(valor).replace(",", "."));
    if (!Number.isNaN(num)) return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (REGEX_DATA_ISO.test(valor) || REGEX_DATA_JS_TOSTRING.test(valor)) {
    const d = new Date(valor);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return valor;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function CreativeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CampaignIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

function HistoryIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 8v4l3 3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function RestoreOutlineIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
      <path d="M17 3.5a4 4 0 0 1 0 7.5" />
    </svg>
  );
}

const TAB_ICONS = { criativos: CreativeIcon, campanhas: CampaignIcon, historico: HistoryIcon, ga4: ChartIcon, planilhas: SheetIcon };

function AcaoBadge({ acao, entidadeTipo }) {
  const estilo = ACAO_ESTILO[acao] || ESTILO_PADRAO;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: estilo.badgeBg, color: estilo.badgeColor, flexShrink: 0 }}>
      {descricaoAcao(acao, entidadeTipo)}
    </span>
  );
}

// Pagina dedicada (nao modal) so para administradores (agencia + isAdmin):
// itens excluidos (soft-delete) de criativos/campanhas, com opcao de
// restaurar ou excluir definitivamente, e o historico combinado de acoes
// admin-only (restaurar/excluir definitivo da lixeira + criacao/exclusao de
// contas de usuario) -- nenhum desses dois aparece no historico comum que
// qualquer agencia ja via (ver actionLogService.js no backend).
export default function AdminPage() {
  const [tab, setTab] = useState("criativos");
  const [busca, setBusca] = useState("");

  // Contagens pra faixa de estatisticas e pros contadores nas abas -- cada
  // painel-filho (ItensTab/HistoricoTab) informa o total real assim que
  // carrega, evitando duplicar as mesmas chamadas de API aqui em cima.
  const [contagens, setContagens] = useState({ criativos: null, campanhas: null, restauracoes7d: null, acoesUsuarios: null });

  function reportarContagem(campo, valor) {
    setContagens((prev) => (prev[campo] === valor ? prev : { ...prev, [campo]: valor }));
  }

  const mostrarBusca = tab !== "ga4" && tab !== "planilhas";

  return (
    <div style={{ paddingTop: 20 }}>
      <div
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 16,
          padding: "20px 26px", borderRadius: 18, overflow: "hidden",
          background: "linear-gradient(120deg, var(--accent) 0%, #0B6E4F 130%)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, opacity: 0.1, pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(120deg, transparent 0 26px, rgba(255,255,255,0.5) 26px 27px)",
          }}
        />
        <div
          style={{
            position: "relative", width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", backdropFilter: "blur(6px)",
          }}
        >
          <ShieldIcon />
        </div>
        <div style={{ position: "relative" }}>
          <h2 style={{ margin: "0 0 2px", fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em", color: "#fff" }}>Visão do Administrador</h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.72)" }}>
            Itens excluídos e histórico de ações restritas a administradores
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 20 }}>
        <StatCard icon={<CreativeIcon />} tone="green" value={contagens.criativos} label="Criativos na lixeira" />
        <StatCard icon={<CampaignIcon />} tone="amber" value={contagens.campanhas} label="Campanhas na lixeira" />
        <StatCard icon={<RestoreOutlineIcon />} tone="blue" value={contagens.restauracoes7d} label="Restaurações (7 dias)" />
        <StatCard icon={<UsersIcon />} tone="grey" value={contagens.acoesUsuarios} label="Ações sobre usuários" />
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
          background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 6,
          boxShadow: "0 1px 2px rgba(20,33,61,0.05)", marginTop: 20,
        }}
      >
        <div style={{ display: "flex", gap: 2, padding: 2, flexWrap: "wrap" }}>
          {TABS.map((t) => {
            const Icon = TAB_ICONS[t.id];
            const ativo = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, border: "none",
                  background: ativo ? "var(--accent)" : "transparent",
                  color: ativo ? "#fff" : "var(--text-secondary)",
                  fontSize: 12.5, fontWeight: 600, padding: "8px 13px", borderRadius: 8, cursor: "pointer",
                  transition: "background 0.15s ease, color 0.15s ease", whiteSpace: "nowrap",
                  boxShadow: ativo ? "0 4px 10px -4px rgba(0,61,42,0.5)" : "none",
                }}
              >
                <Icon />
                {t.label}
                {t.id === "criativos" && contagens.criativos !== null && (
                  <Count ativo={ativo}>{contagens.criativos}</Count>
                )}
                {t.id === "campanhas" && contagens.campanhas !== null && (
                  <Count ativo={ativo}>{contagens.campanhas}</Count>
                )}
              </button>
            );
          })}
        </div>

        {mostrarBusca && (
          <div style={{ position: "relative", display: "flex", alignItems: "center", marginRight: 4 }}>
            <span style={{ position: "absolute", left: 13, color: "var(--text-secondary)", display: "flex" }}><SearchIcon /></span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={tab === "historico" ? "Buscar no histórico..." : "Buscar por nome..."}
              style={{
                width: 300, border: "1px solid transparent", background: "var(--bg)", borderRadius: 9,
                padding: "10px 14px 10px 36px", fontSize: 13, color: "var(--text-primary)", outline: "none",
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent-soft)"; e.target.style.background = "var(--card-bg)"; }}
              onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "var(--bg)"; }}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === "criativos" && <ItensTab tipo="creative" busca={busca} onContagem={(n) => reportarContagem("criativos", n)} />}
        {tab === "campanhas" && <ItensTab tipo="campanha" busca={busca} onContagem={(n) => reportarContagem("campanhas", n)} />}
        {tab === "historico" && (
          <HistoricoTab
            busca={busca}
            onContagem={({ restauracoes7d, acoesUsuarios }) => {
              reportarContagem("restauracoes7d", restauracoes7d);
              reportarContagem("acoesUsuarios", acoesUsuarios);
            }}
          />
        )}
        {tab === "ga4" && <Ga4IntegrationsManagement />}
        {tab === "planilhas" && <SheetIntegrationsManagement />}
      </div>
    </div>
  );
}

function Count({ ativo, children }) {
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
        background: ativo ? "rgba(255,255,255,0.22)" : "var(--border)",
        color: ativo ? "#fff" : "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

const TONE_STYLE = {
  green: { bg: "var(--accent-soft)", color: "var(--accent)" },
  amber: { bg: "rgba(199,127,26,0.14)", color: "#c77f1a" },
  blue: { bg: "rgba(37,99,235,0.12)", color: "#2563eb" },
  grey: { bg: "var(--border)", color: "var(--text-secondary)" },
};

function StatCard({ icon, tone, value, label }) {
  const cor = TONE_STYLE[tone];
  return (
    <div
      className="card"
      style={{ padding: "14px 16px", display: "flex", flexDirection: "column", cursor: "default" }}
    >
      <div
        style={{
          width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: cor.bg, color: cor.color, marginBottom: 8,
        }}
      >
        {icon}
      </div>
      <strong style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value === null ? "—" : value}
      </strong>
      <span style={{ marginTop: 5, fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ItensTab({ tipo, busca, onContagem }) {
  const isCreative = tipo === "creative";
  const [itens, setItens] = useState(null);
  const [error, setError] = useState("");
  const [excluindo, setExcluindo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  function load() {
    const req = isCreative ? getLixeiraCreatives() : getLixeiraCampanhas();
    req
      .then((rows) => {
        setItens(rows);
        onContagem(rows.length);
      })
      .catch(() => setError("Não foi possível carregar a lixeira."));
  }

  useEffect(() => { load(); }, [tipo]);

  const filtrados = useMemo(() => {
    if (!itens) return null;
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((item) => item.nome?.toLowerCase().includes(termo) || item.excluido_por_nome?.toLowerCase().includes(termo));
  }, [itens, busca]);

  async function handleRestaurar(id) {
    setProcessando(true);
    try {
      if (isCreative) await restaurarCreativeLixeira(id);
      else await restaurarCampanhaLixeira(id);
      load();
    } finally {
      setProcessando(false);
    }
  }

  async function handleExcluirDefinitivo() {
    setProcessando(true);
    try {
      if (isCreative) await excluirCreativeDefinitivo(excluindo.id);
      else await excluirCampanhaDefinitiva(excluindo.id);
      setExcluindo(null);
      load();
    } finally {
      setProcessando(false);
    }
  }

  if (error) return <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>;
  if (!filtrados) return <div style={{ padding: "40px 0" }}><Spinner /></div>;
  if (filtrados.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        {busca ? "Nenhum resultado para essa busca." : "Nenhum item na lixeira."}
      </p>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
        {filtrados.map((item) => (
          <div
            key={item.id}
            className="card"
            style={{
              padding: 0, overflow: "hidden", display: "flex", flexDirection: "column",
              borderLeft: "3px solid var(--accent-soft)",
            }}
          >
            {isCreative && item.cloudinary_url ? (
              <div
                onClick={() => setDetalhe(item)}
                style={{ height: 150, background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
              >
                {item.tipo_midia === "video" ? (
                  <video src={item.cloudinary_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <img src={item.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                )}
              </div>
            ) : (
              !isCreative && (
                <div style={{ height: 6, background: "linear-gradient(90deg, var(--accent-soft), transparent)" }} />
              )
            )}
            <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 10 }}>
              <div onClick={() => isCreative && setDetalhe(item)} style={{ cursor: isCreative ? "pointer" : "default" }}>
                <strong style={{ fontSize: 13.5, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.nome}
                </strong>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
                  Excluído por {item.excluido_por_nome || "usuário removido"} · {formatDataHora(item.excluido_em)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <button
                  onClick={() => handleRestaurar(item.id)}
                  disabled={processando}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 999,
                    border: "1px solid #1E9C6B", background: "rgba(30,156,107,0.1)", color: "#1E9C6B",
                    fontSize: 12, fontWeight: 700, cursor: processando ? "default" : "pointer",
                    transition: "background 0.15s ease",
                  }}
                >
                  <RestoreIcon />
                  Restaurar
                </button>
                <button
                  onClick={() => setExcluindo(item)}
                  disabled={processando}
                  title="Excluir definitivamente"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: processando ? "default" : "pointer", flexShrink: 0, transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.borderColor = "var(--danger)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {excluindo && (
        <ConfirmDialog
          title="Excluir definitivamente"
          message={`Tem certeza que deseja excluir "${excluindo.nome}" definitivamente? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir definitivamente"
          confirming={processando}
          onConfirm={handleExcluirDefinitivo}
          onCancel={() => setExcluindo(null)}
        />
      )}

      {detalhe && (
        <CreativeFusedDetailModal
          creative={detalhe}
          campanhaId={detalhe.campanha_id_ref}
          onClose={() => setDetalhe(null)}
          comentariosSomenteLeitura
        />
      )}
    </>
  );
}

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function HistoricoTab({ busca, onContagem }) {
  const [acoes, setAcoes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getLixeiraHistorico(), getUsuariosHistorico()])
      .then(([lixeira, usuarios]) => {
        const combinado = [...lixeira, ...usuarios].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
        setAcoes(combinado);
        const agora = Date.now();
        const restauracoes7d = combinado.filter((a) => a.acao === "restauracao" && agora - new Date(a.criado_em).getTime() <= SETE_DIAS_MS).length;
        onContagem({ restauracoes7d, acoesUsuarios: usuarios.length });
      })
      .catch(() => setError("Não foi possível carregar o histórico."));
  }, []);

  const filtradas = useMemo(() => {
    if (!acoes) return null;
    const termo = busca.trim().toLowerCase();
    if (!termo) return acoes;
    return acoes.filter((a) =>
      a.entidade_nome?.toLowerCase().includes(termo) ||
      a.campo?.toLowerCase().includes(termo) ||
      a.alterado_por_nome?.toLowerCase().includes(termo) ||
      descricaoAcao(a.acao, a.entidade_tipo).toLowerCase().includes(termo)
    );
  }, [acoes, busca]);

  if (error) return <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>;
  if (!filtradas) return <div style={{ padding: "40px 0" }}><Spinner /></div>;
  if (filtradas.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        {busca ? "Nenhum resultado para essa busca." : "Nenhuma ação registrada ainda."}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
      {filtradas.map((a, i) => {
        const estilo = ACAO_ESTILO[a.acao] || ESTILO_PADRAO;
        const ultimo = i === filtradas.length - 1;
        return (
          <div key={`${a.entidade_tipo}-${a.id}`} style={{ position: "relative", display: "flex", gap: 12, padding: "11px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: estilo.linha, boxShadow: `0 0 0 4px ${estilo.badgeBg}`, zIndex: 1 }} />
              {!ultimo && <div style={{ width: 1.5, flex: 1, background: "var(--border)", marginTop: 4 }} />}
            </div>
            <div
              className="card"
              style={{
                flex: 1, padding: "11px 15px", borderLeft: `3px solid ${estilo.linha === "var(--border)" ? "var(--border)" : "var(--accent-soft)"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <AcaoBadge acao={a.acao} entidadeTipo={a.entidade_tipo} />
                <strong style={{ fontSize: 12.5 }}>{a.entidade_nome}</strong>
              </div>
              {(a.acao === "edicao" || a.acao === "status") && (
                <p style={{ margin: "0 0 5px", fontSize: 12.5 }}>
                  <strong>{a.campo}:</strong>{" "}
                  {a.valor_anterior ? `${formatValorCampo(a.valor_anterior, a.campo)} → ` : ""}
                  {formatValorCampo(a.valor_novo, a.campo) || <span style={{ color: "var(--text-secondary)" }}>(vazio)</span>}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>
                {a.origem === "automatico" ? "Sistema (automático)" : a.alterado_por_nome || "Usuário removido"}
                {" · "}
                {formatDataHora(a.criado_em)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
