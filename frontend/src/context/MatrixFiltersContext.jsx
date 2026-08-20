import { createContext, useContext, useState } from "react";
import { useVisualizacao } from "../hooks/useVisualizacao.js";

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
  // Preferencia Grade/Kanban -- exposta aqui (em vez de estado local na view) para
  // que a TopNav renderize o toggle dentro do menu do usuario, igual ao Tema.
  const [visualizacao, setVisualizacao] = useVisualizacao("matriz-visualizacao");
  // true quando um overlay de pagina inteira estiver aberto (ex: HistoricoDrawer,
  // que a TopNav renderiza fora da view) -- usado pelo ActionsRail pra se
  // esconder em vez de ficar visualmente sobreposto/competindo com o drawer.
  const [overlayAberto, setOverlayAberto] = useState(false);

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
        visualizacao, setVisualizacao,
        overlayAberto, setOverlayAberto,
      }}
    >
      {children}
    </MatrixFiltersContext.Provider>
  );
}

export function useMatrixFiltersContext() {
  return useContext(MatrixFiltersContext);
}
