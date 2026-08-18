import { createContext, useContext, useState } from "react";

// Estado dos filtros da Home de Campanhas (busca/status/comparativo), exposto aqui
// para que a TopNav possa renderizar os controles (busca + status + Comparativo +
// contador) quando essa pagina estiver ativa, no mesmo padrao do MatrixFiltersContext.
const CampanhasHomeFiltersContext = createContext(null);

export function CampanhasHomeFiltersProvider({ children }) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [comparativoAberto, setComparativoAberto] = useState(false);
  const [total, setTotal] = useState(null);
  const [temComparativo, setTemComparativo] = useState(false);

  return (
    <CampanhasHomeFiltersContext.Provider
      value={{
        busca, setBusca,
        status, setStatus,
        comparativoAberto, setComparativoAberto,
        total, setTotal,
        temComparativo, setTemComparativo,
      }}
    >
      {children}
    </CampanhasHomeFiltersContext.Provider>
  );
}

export function useCampanhasHomeFiltersContext() {
  return useContext(CampanhasHomeFiltersContext);
}
