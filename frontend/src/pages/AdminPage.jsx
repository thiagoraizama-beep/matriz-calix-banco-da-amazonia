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

const TABS = [
  { id: "criativos", label: "Criativos excluídos" },
  { id: "campanhas", label: "Campanhas excluídas" },
  { id: "historico", label: "Histórico" },
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

const ENTIDADE_LABEL = { campanha: "Campanha", criativo: "Criativo", usuario: "Usuário" };

function descricaoAcao(acao, entidadeTipo) {
  const genero = GENERO_ENTIDADE[entidadeTipo] || "m";
  const participio = ACAO_PARTICIPIO[acao]?.[genero] || acao;
  return `${ENTIDADE_LABEL[entidadeTipo] || entidadeTipo} ${participio}`;
}

// Paleta institucional (verde/terroso do banco) -- nunca vermelho/laranja/roxo
// generico aqui, mesmo para acoes "destrutivas", pra manter a identidade
// visual coerente com o resto do sistema.
const ACAO_COR = {
  criacao: { bg: "rgba(11,110,79,0.12)", color: "#0B6E4F" },
  edicao: { bg: "var(--accent-soft)", color: "var(--accent)" },
  status: { bg: "rgba(30,156,107,0.14)", color: "#1E9C6B" },
  exclusao: { bg: "rgba(78,107,74,0.16)", color: "#4E6B4A" },
  restauracao: { bg: "rgba(30,156,107,0.14)", color: "#1E9C6B" },
  exclusao_definitiva: { bg: "rgba(0,61,42,0.12)", color: "#003D2A" },
};

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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function AcaoBadge({ acao, entidadeTipo }) {
  const cor = ACAO_COR[acao] || { bg: "var(--border)", color: "var(--text-secondary)" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: cor.bg, color: cor.color, flexShrink: 0 }}>
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

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ShieldIcon />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Visão do Administrador</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
            Itens excluídos e histórico de ações restritas a administradores
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 24, marginBottom: 4, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 4px 12px", marginRight: 22, border: "none", background: "transparent",
                color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: tab === t.id ? 700 : 500, fontSize: 13.5, cursor: "pointer",
                borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                transition: "color 0.15s ease, border-color 0.15s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "var(--card-bg)",
            border: "1px solid var(--border)", borderRadius: 999, padding: "8px 14px", width: 260, marginBottom: 10,
          }}
        >
          <span style={{ color: "var(--text-secondary)", display: "flex" }}><SearchIcon /></span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar..."
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--text-primary)", width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === "criativos" && <ItensTab tipo="creative" busca={busca} />}
        {tab === "campanhas" && <ItensTab tipo="campanha" busca={busca} />}
        {tab === "historico" && <HistoricoTab busca={busca} />}
      </div>
    </div>
  );
}

function ItensTab({ tipo, busca }) {
  const isCreative = tipo === "creative";
  const [itens, setItens] = useState(null);
  const [error, setError] = useState("");
  const [excluindo, setExcluindo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  function load() {
    const req = isCreative ? getLixeiraCreatives() : getLixeiraCampanhas();
    req.then(setItens).catch(() => setError("Não foi possível carregar a lixeira."));
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {filtrados.map((item) => (
          <div key={item.id} style={{ background: "var(--card-bg)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(20,33,61,0.06)", display: "flex", flexDirection: "column" }}>
            {isCreative && item.cloudinary_url && (
              <div
                onClick={() => setDetalhe(item)}
                style={{ height: 160, background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
              >
                {item.tipo_midia === "video" ? (
                  <video src={item.cloudinary_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <img src={item.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                )}
              </div>
            )}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div onClick={() => isCreative && setDetalhe(item)} style={{ cursor: isCreative ? "pointer" : "default" }}>
                <strong style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.nome}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
                  Excluído por {item.excluido_por_nome || "usuário removido"} · {formatDataHora(item.excluido_em)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleRestaurar(item.id)}
                  disabled={processando}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 999,
                    border: "1px solid #1E9C6B", background: "rgba(30,156,107,0.1)", color: "#1E9C6B",
                    fontSize: 12.5, fontWeight: 600, cursor: processando ? "default" : "pointer",
                  }}
                >
                  <RestoreIcon />
                  Restaurar
                </button>
                <button
                  onClick={() => setExcluindo(item)}
                  disabled={processando}
                  title="Excluir definitivamente"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: processando ? "default" : "pointer", flexShrink: 0 }}
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

function HistoricoTab({ busca }) {
  const [acoes, setAcoes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getLixeiraHistorico(), getUsuariosHistorico()])
      .then(([lixeira, usuarios]) => {
        const combinado = [...lixeira, ...usuarios].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
        setAcoes(combinado);
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
      ACAO_LABEL[a.acao]?.toLowerCase().includes(termo)
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
      {filtradas.map((a) => (
        <div key={`${a.entidade_tipo}-${a.id}`} style={{ background: "var(--card-bg)", borderRadius: 12, padding: "13px 16px", boxShadow: "0 1px 3px rgba(20,33,61,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <AcaoBadge acao={a.acao} entidadeTipo={a.entidade_tipo} />
            <strong style={{ fontSize: 13 }}>{a.entidade_nome}</strong>
          </div>
          {(a.acao === "edicao" || a.acao === "status") && (
            <p style={{ margin: "0 0 5px", fontSize: 12.5 }}>
              <strong>{a.campo}:</strong>{" "}
              {a.valor_anterior ? `${formatValorCampo(a.valor_anterior, a.campo)} → ` : ""}
              {formatValorCampo(a.valor_novo, a.campo) || <span style={{ color: "var(--text-secondary)" }}>(vazio)</span>}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)" }}>
            {a.origem === "automatico" ? "Sistema (automático)" : a.alterado_por_nome || "Usuário removido"}
            {" · "}
            {formatDataHora(a.criado_em)}
          </p>
        </div>
      ))}
    </div>
  );
}

