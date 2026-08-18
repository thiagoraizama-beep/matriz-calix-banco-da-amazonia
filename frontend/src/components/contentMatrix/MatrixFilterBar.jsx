import MultiSelectDropdown from "../layout/MultiSelectDropdown.jsx";

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export default function MatrixFilterBar({ options, filters, setBusca, setStatus, setVeiculo, setCampanha, setPlataforma }) {
  return (
    <div className="card" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "9px 12px",
          maxWidth: 360,
        }}
      >
        <span style={{ color: "var(--text-secondary)", display: "flex" }}>
          <SearchIcon />
        </span>
        <input
          value={filters.busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar criativo ou campanha..."
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text-primary)", width: "100%" }}
        />
      </div>

      <div className="filter-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Campanha</label>
          <MultiSelectDropdown
            multi
            value={filters.campanha}
            onChange={setCampanha}
            options={options.campanhas}
            placeholder="Todas as campanhas"
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Veículo</label>
          <MultiSelectDropdown
            multi
            value={filters.veiculo}
            onChange={setVeiculo}
            options={options.veiculos}
            placeholder="Todos os veículos"
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Plataforma</label>
          <MultiSelectDropdown
            multi
            value={filters.plataforma}
            onChange={setPlataforma}
            options={options.plataformas}
            placeholder="Todas as plataformas"
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Status</label>
          <MultiSelectDropdown
            multi
            value={filters.status}
            onChange={setStatus}
            options={options.statuses}
            placeholder="Todos os status"
          />
        </div>
      </div>
    </div>
  );
}
