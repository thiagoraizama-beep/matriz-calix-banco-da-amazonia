import { useEffect, useState } from "react";
import {
  getLixeiraCreatives,
  getLixeiraCampanhas,
  restaurarCreativeLixeira,
  restaurarCampanhaLixeira,
  excluirCreativeDefinitivo,
  excluirCampanhaDefinitiva,
  getLixeiraHistorico,
  getUsuariosHistorico,
} from "../../../api/client.js";
import Spinner from "../../common/Spinner.jsx";
import TrashIcon from "../../common/TrashIcon.jsx";
import ConfirmDialog from "../../common/ConfirmDialog.jsx";

const TABS = { CREATIVOS: "criativos", CAMPANHAS: "campanhas", HISTORICO: "historico" };

// Paleta institucional (verde/terroso do banco) -- nunca vermelho/laranja/roxo
// genericos aqui, mesmo para acoes "destrutivas" como exclusao definitiva, para
// nao quebrar a identidade visual da tela (diferente do ActionLogModal comum,
// que usa var(--danger) para exclusao simples).
const ACAO_LABEL = { restauracao: "Restaurado", exclusao_definitiva: "Excluído definitivamente", criacao: "Criado", exclusao: "Excluído" };
const ACAO_COR = {
  restauracao: { bg: "rgba(30,156,107,0.14)", color: "#1E9C6B" },
  exclusao_definitiva: { bg: "rgba(0,61,42,0.12)", color: "#003D2A" },
  criacao: { bg: "rgba(11,110,79,0.12)", color: "#0B6E4F" },
  exclusao: { bg: "rgba(78,107,74,0.16)", color: "#4E6B4A" },
};

function formatDataHora(iso) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

export default function LixeiraModal({ onClose }) {
  const [tab, setTab] = useState(TABS.CREATIVOS);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 700, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(10,16,32,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 16, fontWeight: 700 }}>Lixeira</strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "12px 24px 0" }}>
          {[
            { key: TABS.CREATIVOS, label: "Criativos" },
            { key: TABS.CAMPANHAS, label: "Campanhas" },
            { key: TABS.HISTORICO, label: "Histórico" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 14px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: tab === t.key ? "var(--bg)" : "transparent",
                color: tab === t.key ? "#0B6E4F" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {tab === TABS.CREATIVOS && <ItensTab tipo="creative" />}
          {tab === TABS.CAMPANHAS && <ItensTab tipo="campanha" />}
          {tab === TABS.HISTORICO && <HistoricoTab />}
        </div>
      </div>
    </div>
  );
}

function ItensTab({ tipo }) {
  const isCreative = tipo === "creative";
  const [itens, setItens] = useState(null);
  const [error, setError] = useState("");
  const [excluindo, setExcluindo] = useState(null);
  const [processando, setProcessando] = useState(false);

  function load() {
    const busca = isCreative ? getLixeiraCreatives() : getLixeiraCampanhas();
    busca.then(setItens).catch(() => setError("Não foi possível carregar a lixeira."));
  }

  useEffect(() => { load(); }, [tipo]);

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
  if (!itens) return <div style={{ padding: "30px 0" }}><Spinner /></div>;
  if (itens.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Nenhum item na lixeira.</p>;
  }

  return (
    <>
      {itens.map((item) => (
        <div key={item.id} style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.nome}
            </strong>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)" }}>
              Excluído por {item.excluido_por_nome || "usuário removido"} · {formatDataHora(item.excluido_em)}
            </p>
          </div>
          <button
            onClick={() => handleRestaurar(item.id)}
            disabled={processando}
            title="Restaurar"
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999,
              border: "1px solid #1E9C6B", background: "rgba(30,156,107,0.1)", color: "#1E9C6B",
              fontSize: 12, fontWeight: 600, cursor: processando ? "default" : "pointer", whiteSpace: "nowrap",
            }}
          >
            <RestoreIcon />
            Restaurar
          </button>
          <button
            onClick={() => setExcluindo(item)}
            disabled={processando}
            title="Excluir definitivamente"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: processando ? "default" : "pointer", flexShrink: 0 }}
          >
            <TrashIcon />
          </button>
        </div>
      ))}

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
    </>
  );
}

function HistoricoTab() {
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

  if (error) return <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>;
  if (!acoes) return <div style={{ padding: "30px 0" }}><Spinner /></div>;
  if (acoes.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Nenhuma ação registrada ainda.</p>;
  }

  return acoes.map((a) => {
    const cor = ACAO_COR[a.acao] || { bg: "var(--border)", color: "var(--text-secondary)" };
    return (
      <div key={a.id} style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: cor.bg, color: cor.color, flexShrink: 0 }}>
            {ACAO_LABEL[a.acao] || a.acao}
          </span>
          <strong style={{ fontSize: 13 }}>{a.entidade_nome}</strong>
          <span style={{ fontSize: 10.5, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
            {a.entidade_tipo === "campanha" ? "Campanha" : a.entidade_tipo === "usuario" ? "Usuário" : "Criativo"}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)" }}>
          {a.alterado_por_nome || "Usuário removido"}
          {" · "}
          {formatDataHora(a.criado_em)}
        </p>
      </div>
    );
  });
}
