import { STATUS_COLORS } from "../statusBadge.jsx";

// Barra lateral de filtros (Status + Plataforma) + Verba total -- substitui os
// status pills horizontais + abas de plataforma no modo Grade/Foco desktop.
// So aparece no modo Grade/Foco (ver AgencyMatrixView.jsx); o Kanban continua
// com o layout de pills horizontais que ja tinha, sem essa barra lateral.
//
// Status vira chips horizontais (multi-selecao, como sempre foi -- varios
// status podem estar marcados ao mesmo tempo) para nao ocupar tanta altura.
// Plataforma vira lista de radio (selecao unica por natureza -- so faz
// sentido ver 1 plataforma de cada vez ou "Todas") para deixar essa
// diferenca de comportamento visualmente clara, em vez dos dois grupos
// parecerem o mesmo tipo de controle. Verba total fecha a sidebar com um
// anel de progresso (Gasto/Verba em %) em vez da barra linear anterior.
export default function MatrixSidebarFilters({
  statusCounts, filtrosStatus, onToggleStatus,
  plataformasCounts, plataformaAtiva, onSelecionarPlataforma, totalCreativos,
  verbaPlanejada, verbaRealizada,
}) {
  const pctGasto = verbaPlanejada > 0 ? Math.min(100, (verbaRealizada / verbaPlanejada) * 100) : 0;
  const estourou = verbaRealizada > verbaPlanejada;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: 190, flexShrink: 0 }}>
      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Status
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {Object.entries(statusCounts).map(([status, count]) => {
          const ativo = filtrosStatus.includes(status);
          const cor = STATUS_COLORS[status] || { color: "var(--text-secondary)", bg: "var(--border)" };
          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggleStatus(status)}
              style={{
                display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
                padding: "5px 10px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${ativo ? cor.color : "var(--border)"}`,
                background: ativo ? cor.bg : "var(--card-bg)",
                color: ativo ? cor.color : "var(--text-secondary)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: cor.color, flexShrink: 0 }} />
              {status} {count}
            </button>
          );
        })}
      </div>

      {plataformasCounts.size > 0 && (
        <>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Plataforma
          </p>
          <div style={{ marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => onSelecionarPlataforma(null)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 0",
                border: "none", background: "transparent", cursor: "pointer",
                fontWeight: 600, fontSize: 12.5, color: !plataformaAtiva ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <RadioDot ativo={!plataformaAtiva} />
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Todas</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)" }}>{totalCreativos}</span>
            </button>
            {[...plataformasCounts.entries()].map(([nome, count]) => {
              const ativo = plataformaAtiva === nome;
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => onSelecionarPlataforma(nome)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 0",
                    border: "none", background: "transparent", cursor: "pointer",
                    fontWeight: 600, fontSize: 12.5, color: ativo ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  <RadioDot ativo={ativo} />
                  <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)" }}>{count}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {verbaPlanejada > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Gasto / Verba
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 20, fontWeight: 700, color: estourou ? "var(--danger)" : "var(--text-primary)" }}>
              {Math.round(pctGasto)}%
            </p>
          </div>
          <div
            title={`${verbaRealizada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de ${verbaPlanejada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: `conic-gradient(${estourou ? "var(--danger)" : "var(--accent)"} 0% ${pctGasto}%, var(--border) ${pctGasto}% 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--bg)" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function RadioDot({ ativo }) {
  return (
    <span
      style={{
        width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${ativo ? "var(--accent)" : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {ativo && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />}
    </span>
  );
}
