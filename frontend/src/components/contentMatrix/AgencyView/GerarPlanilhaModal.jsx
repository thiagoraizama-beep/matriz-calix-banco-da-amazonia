import { useEffect, useMemo, useState } from "react";
import {
  getCreativesByCampanha, exportCreativesExcel,
  getSheetSyncStatus, saveSheetSync, sincronizarLinkPublicacaoDaPlanilha,
} from "../../../api/client.js";
import { extrairSpreadsheetId } from "../../../utils/extrairSpreadsheetId.js";
import ColunasConfigSection from "./ColunasConfigSection.jsx";

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
    </svg>
  );
}

// Modal unico do FAB "Gerar planilha": lista os criativos da campanha
// (agrupados por plataforma), usuario marca quais quer incluir. Com a
// selecao feita, pode baixar como Excel e/ou publicar no Google Sheets --
// publicar salva a selecao no backend, que sincroniza na hora (desmarcar um
// criativo que ja estava na planilha remove a linha dele).
export default function GerarPlanilhaModal({ campanhaId, campanhaNome, onClose }) {
  const [creatives, setCreatives] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [spreadsheetInput, setSpreadsheetInput] = useState("");
  const [sheetStatus, setSheetStatus] = useState(null);
  const [trocandoPlanilha, setTrocandoPlanilha] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [verificandoLinks, setVerificandoLinks] = useState(false);
  const [linksVerificadosEm, setLinksVerificadosEm] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([getCreativesByCampanha(campanhaId), getSheetSyncStatus(campanhaId)]).then(([lista, status]) => {
      setCreatives(lista);
      setSelecionados(new Set(status.selecionados?.length ? status.selecionados : lista.map((c) => c.id)));
      setSheetStatus(status);
      setSpreadsheetInput(status.spreadsheetId || "");
    });
  }, [campanhaId]);

  // Ja tem planilha vinculada: campo trava por padrao (mostra o link, so
  // texto) pra evitar trocar sem querer -- "Trocar planilha" destrava.
  const planilhaJaVinculada = !!sheetStatus?.spreadsheetId;
  const campoEditavel = !planilhaJaVinculada || trocandoPlanilha;

  const porPlataforma = useMemo(() => {
    if (!creatives) return [];
    const mapa = new Map();
    for (const c of creatives) {
      const chave = c.plataforma || "Sem plataforma";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(c);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [creatives]);

  function toggle(id) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePlataforma(idsDaPlataforma, todosMarcados) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      idsDaPlataforma.forEach((id) => (todosMarcados ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function handleExportarExcel() {
    setExportando(true);
    setErro("");
    try {
      const plataformasSelecionadas = porPlataforma
        .filter(([, itens]) => itens.some((c) => selecionados.has(c.id)))
        .map(([plataforma]) => plataforma);
      await exportCreativesExcel(campanhaId, campanhaNome, plataformasSelecionadas);
    } catch {
      setErro("Não foi possível gerar o Excel.");
    } finally {
      setExportando(false);
    }
  }

  async function handlePublicarSheets() {
    const spreadsheetId = extrairSpreadsheetId(spreadsheetInput);
    if (!spreadsheetId) {
      setErro("Cole o link ou ID da planilha do Google Sheets.");
      return;
    }
    setPublicando(true);
    setErro("");
    try {
      const status = await saveSheetSync(campanhaId, {
        spreadsheetId,
        creativeIds: [...selecionados],
      });
      setSheetStatus(status);
      setSpreadsheetInput(status.spreadsheetId || "");
      setTrocandoPlanilha(false);
      if (status.ultimoErro) setErro(status.ultimoErro);
    } catch (err) {
      setErro(err.response?.data?.error || "Não foi possível publicar na planilha.");
    } finally {
      setPublicando(false);
    }
  }

  async function handleVerificarLinks() {
    setVerificandoLinks(true);
    setErro("");
    try {
      await sincronizarLinkPublicacaoDaPlanilha(campanhaId);
      setLinksVerificadosEm(new Date());
    } catch (err) {
      setErro(err.response?.data?.error || "Não foi possível verificar os links da planilha.");
    } finally {
      setVerificandoLinks(false);
    }
  }

  const totalMarcados = selecionados.size;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,14,25,0.5)" }} />
      <div
        style={{
          position: "relative", width: 420, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto",
          background: "var(--card-bg)", borderRadius: 14, boxShadow: "0 20px 48px rgba(20,33,61,0.25)", padding: 20,
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "var(--text-primary)" }}>Gerar planilha</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-secondary)" }}>
          Marque os criativos que quer incluir. Você pode baixar em Excel e/ou publicar no Google Sheets.
        </p>

        {!creatives && <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Carregando...</p>}

        {creatives?.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhum criativo cadastrado nesta campanha.</p>
        )}

        {porPlataforma.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, maxHeight: 260, overflowY: "auto" }}>
            {porPlataforma.map(([plataforma, itens]) => {
              const ids = itens.map((c) => c.id);
              const todosMarcados = ids.every((id) => selecionados.has(id));
              return (
                <div key={plataforma}>
                  <label
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 8,
                      background: "var(--bg)", fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={todosMarcados} onChange={() => togglePlataforma(ids, todosMarcados)} />
                    {plataforma}
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, paddingLeft: 8 }}>
                    {itens.map((c) => (
                      <label
                        key={c.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", borderRadius: 8,
                          fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer",
                        }}
                      >
                        <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => toggle(c.id)} />
                        {c.titulo || c.nome || `Criativo #${c.id}`}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {creatives?.length > 0 && <ColunasConfigSection campanhaId={campanhaId} porPlataforma={porPlataforma} />}

        {creatives?.length > 0 && (
          <>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                  Planilha do Google Sheets
                </label>
                {planilhaJaVinculada && (
                  <button
                    type="button"
                    onClick={() => {
                      if (trocandoPlanilha) setSpreadsheetInput(sheetStatus.spreadsheetId || "");
                      setTrocandoPlanilha((t) => !t);
                    }}
                    style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}
                  >
                    {trocandoPlanilha ? "Cancelar" : "Trocar planilha"}
                  </button>
                )}
              </div>

              {campoEditavel ? (
                <input
                  type="text"
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  placeholder="Cole o link ou ID da planilha"
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg)", color: "var(--text-primary)", fontSize: 12.5, boxSizing: "border-box",
                  }}
                />
              ) : (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${sheetStatus.spreadsheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block", width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg)", color: "var(--text-secondary)", fontSize: 12.5, boxSizing: "border-box",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none",
                  }}
                >
                  {`https://docs.google.com/spreadsheets/d/${sheetStatus.spreadsheetId}`}
                </a>
              )}

              {sheetStatus?.ultimaSincronizacaoEm && (
                <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--text-secondary)" }}>
                  Sincronizado às {new Date(sheetStatus.ultimaSincronizacaoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}

              {planilhaJaVinculada && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={handleVerificarLinks}
                    disabled={verificandoLinks}
                    style={{
                      background: "none", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 10px",
                      fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", cursor: verificandoLinks ? "default" : "pointer",
                      opacity: verificandoLinks ? 0.6 : 1,
                    }}
                  >
                    {verificandoLinks ? "Verificando..." : "Verificar links da planilha"}
                  </button>
                  {linksVerificadosEm && !verificandoLinks && (
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      Ok às {linksVerificadosEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              )}
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
                Preencheu "Link da publicação" direto na planilha? Isso é lido automaticamente
                (1x por dia, ou clicando acima) e aplicado nos criativos Impulsionados. Os
                demais campos da planilha continuam só de leitura.
              </p>
            </div>

            {erro && <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--danger)" }}>{erro}</p>}

            <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-secondary)" }}>
              {totalMarcados} de {creatives.length} criativo{creatives.length === 1 ? "" : "s"} selecionado{totalMarcados === 1 ? "" : "s"}.
            </p>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Fechar
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleExportarExcel}
              disabled={!creatives?.length || totalMarcados === 0 || exportando}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999,
                border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: !creatives?.length || totalMarcados === 0 || exportando ? 0.55 : 1,
              }}
            >
              <DownloadIcon />
              {exportando ? "Gerando..." : "Baixar Excel"}
            </button>
            <button
              type="button"
              onClick={handlePublicarSheets}
              disabled={!creatives?.length || publicando}
              style={{
                padding: "8px 14px", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: !creatives?.length || publicando ? 0.55 : 1,
              }}
            >
              {publicando ? "Publicando..." : planilhaJaVinculada ? "Atualizar planilha" : "Publicar no Sheets"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
