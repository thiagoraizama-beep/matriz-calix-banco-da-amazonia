import { query } from "../config/database.js";
import { COLUNAS_BASE, COLUNAS_GOOGLE, ehPlataformaGoogle } from "./creativesExportService.js";

// Colunas padrao pra uma plataforma, antes de qualquer configuracao do
// usuario -- mesma logica ja usada na exportacao (colunasDaAba local).
function colunasPadraoDaPlataforma(plataforma) {
  const base = ehPlataformaGoogle(plataforma) ? [...COLUNAS_BASE, ...COLUNAS_GOOGLE] : COLUNAS_BASE;
  return base.map((c) => c.key);
}

export async function getExportConfig(campanhaId) {
  const { rows } = await query("SELECT colunas_config FROM campanha_export_config WHERE campanha_id = $1", [campanhaId]);
  return rows[0]?.colunas_config || { porPlataforma: {}, porCriativo: {} };
}

export async function setExportConfig(campanhaId, colunasConfig) {
  const { rows } = await query(
    `INSERT INTO campanha_export_config (campanha_id, colunas_config, atualizado_em)
     VALUES ($1, $2, now())
     ON CONFLICT (campanha_id) DO UPDATE SET colunas_config = $2, atualizado_em = now()
     RETURNING colunas_config`,
    [campanhaId, JSON.stringify(colunasConfig)]
  );
  return rows[0].colunas_config;
}

// Resolve as colunas EFETIVAS pra um criativo: override por criativo, senao
// override por plataforma, senao o padrao do sistema pra aquela plataforma.
function keysEfetivasDoCreative(config, plataforma, creativeId) {
  return (
    config?.porCriativo?.[creativeId] ||
    config?.porPlataforma?.[plataforma] ||
    colunasPadraoDaPlataforma(plataforma)
  );
}

// Colunas de uma ABA inteira = uniao das colunas efetivas de todos os
// criativos que vao entrar nela -- criativo customizado com menos/mais
// colunas que os outros da mesma plataforma nao quebra a tabela, so deixa a
// celula vazia nas colunas que nao se aplicam aquela linha. Mantem a ordem
// original de COLUNAS_BASE+COLUNAS_GOOGLE, nunca a ordem de insercao.
export function resolverColunasDaAba(config, plataforma, creatives) {
  const todasDisponiveis = [...COLUNAS_BASE, ...COLUNAS_GOOGLE];
  const keysUniao = new Set();
  for (const c of creatives) {
    for (const key of keysEfetivasDoCreative(config, plataforma, c.id)) keysUniao.add(key);
  }
  return todasDisponiveis.filter((c) => keysUniao.has(c.key));
}

export { colunasPadraoDaPlataforma };
