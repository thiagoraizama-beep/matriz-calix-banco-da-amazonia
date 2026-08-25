import { useEffect, useState } from "react";
import { getExportColumnsConfig, saveExportColumnsConfig } from "../../../api/client.js";

function ChevronIcon({ aberto }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      style={{ transform: aberto ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// Secao colapsavel do modal "Gerar planilha": deixa marcar/desmarcar quais
// colunas aparecem no Excel/Sheets, por plataforma (padrao que vale pra
// todos os criativos daquela plataforma) e, opcionalmente, por criativo
// individual (excecao que sobrepoe o padrao da plataforma so pra aquele
// criativo). Fica fechada por padrao -- a maioria das gerações usa o padrao
// do sistema sem precisar mexer aqui.
export default function ColunasConfigSection({ campanhaId, porPlataforma }) {
  const [aberto, setAberto] = useState(false);
  const [colunasBase, setColunasBase] = useState([]);
  const [colunasGoogle, setColunasGoogle] = useState([]);
  const [config, setConfig] = useState({ porPlataforma: {}, porCriativo: {} });
  const [plataformaExpandida, setPlataformaExpandida] = useState(null);
  const [criativoExpandido, setCriativoExpandido] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || colunasBase.length) return;
    getExportColumnsConfig(campanhaId).then((data) => {
      setColunasBase(data.colunasBase);
      setColunasGoogle(data.colunasGoogle);
      setConfig({
        porPlataforma: data.config?.porPlataforma || {},
        porCriativo: data.config?.porCriativo || {},
      });
    });
  }, [aberto, campanhaId, colunasBase.length]);

  function colunasDisponiveisPara(plataforma) {
    const ehGoogle = (plataforma || "").toLowerCase().includes("google");
    return ehGoogle ? [...colunasBase, ...colunasGoogle] : colunasBase;
  }

  function keysAtivasPlataforma(plataforma) {
    return config.porPlataforma[plataforma] || colunasDisponiveisPara(plataforma).map((c) => c.key);
  }

  function keysAtivasCriativo(plataforma, creativeId) {
    return config.porCriativo[creativeId] || keysAtivasPlataforma(plataforma);
  }

  async function persistir(novoConfig) {
    setSalvando(true);
    try {
      const salvo = await saveExportColumnsConfig(campanhaId, novoConfig);
      setConfig(salvo.config);
    } finally {
      setSalvando(false);
    }
  }

  function toggleColunaPlataforma(plataforma, key) {
    const atuais = keysAtivasPlataforma(plataforma);
    const novas = atuais.includes(key) ? atuais.filter((k) => k !== key) : [...atuais, key];
    persistir({ ...config, porPlataforma: { ...config.porPlataforma, [plataforma]: novas } });
  }

  function toggleColunaCriativo(plataforma, creativeId, key) {
    const atuais = keysAtivasCriativo(plataforma, creativeId);
    const novas = atuais.includes(key) ? atuais.filter((k) => k !== key) : [...atuais, key];
    persistir({ ...config, porCriativo: { ...config.porCriativo, [creativeId]: novas } });
  }

  function restaurarPadraoCriativo(creativeId) {
    const { [creativeId]: _remover, ...resto } = config.porCriativo;
    persistir({ ...config, porCriativo: resto });
  }

  const checkboxStyle = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" };

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0,
          fontSize: 12, fontWeight: 700, color: "var(--text-primary)", cursor: "pointer",
        }}
      >
        <ChevronIcon aberto={aberto} />
        Colunas {salvando && "· salvando..."}
      </button>

      {aberto && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {!colunasBase.length && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Carregando...</p>}

          {colunasBase.length > 0 && porPlataforma.map(([plataforma, itens]) => {
            const disponiveis = colunasDisponiveisPara(plataforma);
            const ativasPlataforma = keysAtivasPlataforma(plataforma);
            const plataformaAberta = plataformaExpandida === plataforma;
            return (
              <div key={plataforma} style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 10px" }}>
                <button
                  type="button"
                  onClick={() => setPlataformaExpandida(plataformaAberta ? null : plataforma)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", padding: 0,
                    fontSize: 12, fontWeight: 700, color: "var(--text-primary)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <ChevronIcon aberto={plataformaAberta} />
                  {plataforma}
                  <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>({ativasPlataforma.length} de {disponiveis.length} colunas)</span>
                </button>

                {plataformaAberta && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {disponiveis.map((col) => (
                        <label key={col.key} style={checkboxStyle}>
                          <input
                            type="checkbox"
                            checked={ativasPlataforma.includes(col.key)}
                            onChange={() => toggleColunaPlataforma(plataforma, col.key)}
                          />
                          {col.header}
                        </label>
                      ))}
                    </div>

                    <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Personalizar por criativo</p>
                      {itens.map((c) => {
                        const temOverride = !!config.porCriativo[c.id];
                        const criativoAberto = criativoExpandido === c.id;
                        return (
                          <div key={c.id} style={{ marginBottom: 4 }}>
                            <button
                              type="button"
                              onClick={() => setCriativoExpandido(criativoAberto ? null : c.id)}
                              style={{
                                display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", padding: "3px 0",
                                fontSize: 11.5, color: "var(--text-secondary)", cursor: "pointer", textAlign: "left",
                              }}
                            >
                              <ChevronIcon aberto={criativoAberto} />
                              {c.titulo || c.nome || `Criativo #${c.id}`}
                              {temOverride && <span style={{ color: "var(--accent)", fontWeight: 700 }}>· personalizado</span>}
                            </button>
                            {criativoAberto && (
                              <div style={{ paddingLeft: 18 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
                                  {disponiveis.map((col) => (
                                    <label key={col.key} style={checkboxStyle}>
                                      <input
                                        type="checkbox"
                                        checked={keysAtivasCriativo(plataforma, c.id).includes(col.key)}
                                        onChange={() => toggleColunaCriativo(plataforma, c.id, col.key)}
                                      />
                                      {col.header}
                                    </label>
                                  ))}
                                </div>
                                {temOverride && (
                                  <button
                                    type="button"
                                    onClick={() => restaurarPadraoCriativo(c.id)}
                                    style={{ background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 700, color: "var(--accent)", cursor: "pointer" }}
                                  >
                                    Restaurar padrão da plataforma
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
