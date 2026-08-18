import { createContext, useContext, useState } from "react";

// Estado dos filtros da Matriz de Conteudo (busca/status/veiculo/campanha/plataforma),
// exposto aqui para que a TopNav possa renderizar os controles (busca + botao Filtro)
// quando essa pagina estiver ativa, sem prop-drilling atraves do AuthenticatedApp.
// As proprias views (Agencia/Veiculo/Cliente) consomem os mesmos valores via
// useMatrixFilters para filtrar a lista de criativos.
const MatrixFiltersContext = createContext(null);

export function MatrixFiltersProvider({ children }) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState([]);
  const [veiculo, setVeiculo] = useState([]);
  const [campanha, setCampanha] = useState([]);
  const [plataforma, setPlataforma] = useState([]);
  const [modeloCompra, setModeloCompra] = useState([]);
  const [matrixOptions, setMatrixOptions] = useState({ statuses: [], veiculos: [], campanhas: [], plataformas: [], modelosCompra: [] });

  return (
    <MatrixFiltersContext.Provider
      value={{
        busca, setBusca,
        status, setStatus,
        veiculo, setVeiculo,
        campanha, setCampanha,
        plataforma, setPlataforma,
        modeloCompra, setModeloCompra,
        matrixOptions, setMatrixOptions,
      }}
    >
      {children}
    </MatrixFiltersContext.Provider>
  );
}

export function useMatrixFiltersContext() {
  return useContext(MatrixFiltersContext);
}
