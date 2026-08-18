import { useState } from "react";
import MultiSelectDropdown from "../layout/MultiSelectDropdown.jsx";
import MobileTopBar from "../layout/MobileTopBar.jsx";
import MobileFilterModal from "../layout/MobileFilterModal.jsx";
import ThemeToggle from "../layout/ThemeToggle.jsx";
import { useMobileNav } from "../../context/MobileNavContext.jsx";

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16l-6 8v6l-4-2v-4z" />
    </svg>
  );
}

// Barra fixa mobile compartilhada pelas 3 visoes da Matriz de Conteudo
// (Agencia/Cliente/Veiculo): hamburguer + Filtros + Tema, com o slot
// extraAction reservado para o botao "+ Novo criativo" (so a agencia tem).
export default function MatrixMobileHeader({ options, filters, setBusca, setStatus, setVeiculo, setCampanha, setPlataforma, setModeloCompra, extraAction }) {
  const { openMobileMenu } = useMobileNav();
  const [open, setOpen] = useState(false);

  return (
    <MobileTopBar onOpenMenu={openMobileMenu}>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-primary)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <FilterIcon />
        Filtros
      </button>
      <ThemeToggle variant="plain" />
      {extraAction}

      {open && (
        <MobileFilterModal title="Filtros" onClose={() => setOpen(false)}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Status</label>
            <MultiSelectDropdown multi value={filters.status} onChange={setStatus} options={options.statuses} placeholder="Todos os status" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Veículo</label>
            <MultiSelectDropdown multi value={filters.veiculo} onChange={setVeiculo} options={options.veiculos} placeholder="Todos os veículos" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Campanha</label>
            <MultiSelectDropdown multi value={filters.campanha} onChange={setCampanha} options={options.campanhas} placeholder="Todas as campanhas" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Plataforma</label>
            <MultiSelectDropdown multi value={filters.plataforma} onChange={setPlataforma} options={options.plataformas} placeholder="Todas as plataformas" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Modelo de compra</label>
            <MultiSelectDropdown multi value={filters.modeloCompra} onChange={setModeloCompra} options={options.modelosCompra} placeholder="Todos os modelos" />
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Aplicar
          </button>
        </MobileFilterModal>
      )}
    </MobileTopBar>
  );
}
