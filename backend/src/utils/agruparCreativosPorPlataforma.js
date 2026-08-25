// Agrupa criativos por plataforma/canal (Meta, Google, TikTok...), mesma
// organizacao usada tanto no Excel exportado quanto na planilha Google
// Sheets sincronizada -- extraido pra nao duplicar a logica nos dois lugares.
export function agruparCreativosPorPlataforma(creatives, plataformasFiltro) {
  const filtro = Array.isArray(plataformasFiltro) && plataformasFiltro.length ? new Set(plataformasFiltro) : null;
  const porPlataforma = new Map();
  for (const c of creatives) {
    const chave = c.plataforma || "Sem plataforma";
    if (filtro && !filtro.has(chave)) continue;
    if (!porPlataforma.has(chave)) porPlataforma.set(chave, []);
    porPlataforma.get(chave).push(c);
  }
  const ordenadas = [...porPlataforma.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { porPlataforma, ordenadas };
}
