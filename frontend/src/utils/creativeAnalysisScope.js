// Campanhas (com plataformas, status e periodo) que o usuario tem permissao de ver
// em Analise por Criativo. Cada vinculo campanha+veiculo define, dentre as
// plataformas que trabalha, QUAIS aparecem em Analise por Criativo
// (plataformasAnaliseCriativo) -- ex: Google Search e Meta Ads aparecem,
// Programatica nao.
// - Veiculo/parceiro: deriva de user.escopos, restrito aos vinculos com
//   acessoAnaliseCriativo=true NESTA campanha especifica.
// - Agencia/cliente: sem restricao de escopo, deriva de "campanhas" (todas as
//   campanhas com vinculos, buscadas via GET /campanhas).
export function campanhasComAnalise(user, campanhas) {
  if (user?.papel !== "veiculo" && user?.papel !== "parceiro") {
    return (campanhas || [])
      .map((c) => ({
        campanhaId: c.id,
        campanhaNome: c.nome,
        status: c.status || "ativo",
        dataInicio: c.data_inicio,
        dataFim: c.data_fim,
        plataformas: [
          ...new Set(
            c.veiculos
              .filter((v) => v.acessoAnaliseCriativo !== false)
              .flatMap((v) => v.plataformasAnaliseCriativo || [])
          ),
        ],
      }))
      .filter((c) => c.plataformas.length > 0);
  }

  const escopos = Array.isArray(user?.escopos) ? user.escopos : [];
  const porCampanha = new Map();
  for (const e of escopos) {
    if (e.acessoAnaliseCriativo !== true) continue;
    if (!porCampanha.has(e.campanhaId)) {
      porCampanha.set(e.campanhaId, {
        campanhaId: e.campanhaId,
        campanhaNome: e.campanha,
        status: e.campanhaStatus || "ativo",
        dataInicio: e.data_inicio,
        dataFim: e.data_fim,
        plataformas: new Set(),
      });
    }
    for (const p of e.plataformasAnaliseCriativo || []) porCampanha.get(e.campanhaId).plataformas.add(p);
  }
  return [...porCampanha.values()]
    .map((c) => ({ ...c, plataformas: [...c.plataformas] }))
    .filter((c) => c.plataformas.length > 0);
}
