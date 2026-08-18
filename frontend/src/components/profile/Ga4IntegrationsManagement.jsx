import { useEffect, useState } from "react";
import { getCampanhas, getGa4ServiceAccount, updateGa4PropertyId } from "../../api/client.js";

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Vincula o Property ID de uma propriedade GA4 a cada campanha -- usado para
// resolver sessoes/leads por criativo (casados pela URL de destino cadastrada),
// exibidos na aba Performance do detalhe do criativo. Sem vinculo, a campanha
// simplesmente nao mostra essas duas metricas (degrada gracioso).
export default function Ga4IntegrationsManagement() {
  const [campanhas, setCampanhas] = useState(null);
  const [serviceAccountEmail, setServiceAccountEmail] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorId, setErrorId] = useState(null);
  // Id da campanha com o campo de Property ID aberto para edicao neste momento --
  // por padrao nenhuma esta em edicao; a lista mostra so o valor salvo (ou o botao
  // "Vincular" se ainda nao tem) e o input so aparece ao clicar Editar/Vincular.
  const [editandoId, setEditandoId] = useState(null);

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
    setDrafts((prev) => ({ ...prev, [c.id]: c.ga4_property_id || "" }));
    setErrorId(null);
    setEditandoId(c.id);
  }

  async function handleSave(campanhaId) {
    setSavingId(campanhaId);
    setErrorId(null);
    try {
      await updateGa4PropertyId(campanhaId, drafts[campanhaId]?.trim() || null);
      setEditandoId(null);
      load();
    } catch (err) {
      setErrorId(campanhaId);
      console.error("Falha ao salvar Property ID GA4:", err);
    } finally {
      setSavingId(null);
    }
  }

  async function handleRemover(campanhaId) {
    setSavingId(campanhaId);
    setErrorId(null);
    try {
      await updateGa4PropertyId(campanhaId, null);
      setEditandoId(null);
      load();
    } catch (err) {
      setErrorId(campanhaId);
      console.error("Falha ao remover Property ID GA4:", err);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <p className="card-title" style={{ margin: 0 }}>Integrações GA4</p>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 16px" }}>
        Vincule o Property ID da propriedade GA4 de cada campanha para ver Sessões e Leads (casados pela URL de
        destino dos criativos) na aba Performance. A conta de serviço abaixo precisa ser adicionada como
        <strong> Visualizador</strong> na propriedade GA4 correspondente.
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
          {campanhas.map((c) => {
            return (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.nome}
                  </span>

                  {editandoId === c.id ? (
                    <>
                      <input
                        autoFocus
                        value={drafts[c.id] ?? ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Property ID (ex: 123456789)"
                        style={{ width: 220, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-primary)", fontSize: 12.5 }}
                      />
                      <button
                        onClick={() => handleSave(c.id)}
                        disabled={savingId === c.id}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: savingId === c.id ? "default" : "pointer", opacity: savingId === c.id ? 0.6 : 1 }}
                      >
                        {savingId === c.id ? "Salvando..." : "Salvar"}
                      </button>
                      <button
                        onClick={() => { setEditandoId(null); setErrorId(null); }}
                        disabled={savingId === c.id}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : c.ga4_property_id ? (
                    <>
                      <code style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.ga4_property_id}</code>
                      <button
                        onClick={() => abrirEdicao(c)}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleRemover(c.id)}
                        disabled={savingId === c.id}
                        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 12, cursor: savingId === c.id ? "default" : "pointer", opacity: savingId === c.id ? 0.6 : 1 }}
                      >
                        {savingId === c.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => abrirEdicao(c)}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Vincular
                    </button>
                  )}
                </div>
                {errorId === c.id && (
                  <span style={{ fontSize: 11.5, color: "var(--danger)", textAlign: "right" }}>
                    Não foi possível salvar. Confira o Property ID e tente novamente.
                  </span>
                )}
              </div>
            );
          })}
          {campanhas.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Nenhuma campanha cadastrada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
}
