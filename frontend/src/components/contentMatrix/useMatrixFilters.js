import { useEffect, useMemo } from "react";
import { useMatrixFiltersContext } from "../../context/MatrixFiltersContext.jsx";

// Deriva as opcoes de filtro (status, veiculo, campanha, plataforma) a partir dos
// proprios criativos cadastrados -- nao existe lista fixa, as opcoes so aparecem
// depois que algum criativo com aquele valor for cadastrado.
// Os valores de filtro em si vivem no MatrixFiltersContext (compartilhado com a
// TopNav, que renderiza os controles quando a Matriz esta ativa).
export function useMatrixFilters(creatives) {
  const ctx = useMatrixFiltersContext();
  const {
    busca, setBusca,
    status, setStatus,
    veiculo, setVeiculo,
    campanha, setCampanha,
    plataforma, setPlataforma,
    modeloCompra, setModeloCompra,
    setMatrixOptions,
  } = ctx;

  const options = useMemo(() => {
    const list = creatives || [];
    return {
      statuses: [...new Set(list.map((c) => c.status))].filter(Boolean).sort(),
      veiculos: [...new Set(list.map((c) => c.veiculo))].filter(Boolean).sort(),
      campanhas: [...new Set(list.map((c) => c.campanha))].filter(Boolean).sort(),
      plataformas: [...new Set(list.map((c) => c.plataforma))].filter(Boolean).sort(),
      modelosCompra: [...new Set(list.flatMap((c) => c.tipos_compra || []))].filter(Boolean).sort(),
    };
  }, [creatives]);

  useEffect(() => {
    setMatrixOptions(options);
    return () => setMatrixOptions({ statuses: [], veiculos: [], campanhas: [], plataformas: [], modelosCompra: [] });
  }, [options]);

  const filtered = useMemo(() => {
    const list = creatives || [];
    const termo = busca.trim().toLowerCase();
    return list.filter(
      (c) =>
        (status.length === 0 || status.includes(c.status)) &&
        (veiculo.length === 0 || veiculo.includes(c.veiculo)) &&
        (campanha.length === 0 || campanha.includes(c.campanha)) &&
        (plataforma.length === 0 || plataforma.includes(c.plataforma)) &&
        (modeloCompra.length === 0 || (c.tipos_compra || []).some((t) => modeloCompra.includes(t))) &&
        (!termo || c.nome?.toLowerCase().includes(termo) || c.campanha?.toLowerCase().includes(termo))
    );
  }, [creatives, busca, status, veiculo, campanha, plataforma, modeloCompra]);

  return {
    filtered,
    options,
    filters: { busca, status, veiculo, campanha, plataforma, modeloCompra },
    setBusca,
    setStatus,
    setVeiculo,
    setCampanha,
    setPlataforma,
    setModeloCompra,
  };
}
