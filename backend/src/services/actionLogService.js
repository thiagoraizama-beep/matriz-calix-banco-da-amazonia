import { query } from "../config/database.js";

// Resolve o id da campanha "dona" de um criativo, mesmo padrao de escopo usado
// no resto do sistema (ex: listCreativesByCampanha em creativesService.js):
// criativos "novos" tem campanha_veiculo_id -> campanha_veiculos.campanha_id;
// criativos legados (campanha_veiculo_id nulo) caem no fallback pelo texto
// solto creatives.campanha -> campanhas.nome. Retorna null se nao encontrar
// (ex: campanha ja foi excluida) -- nesse caso o log simplesmente nao e
// gravado, ja que a tabela exige campanha_id.
export async function resolveCampanhaIdDoCreative(creative) {
  if (creative.campanha_veiculo_id) {
    const { rows } = await query("SELECT campanha_id FROM campanha_veiculos WHERE id = $1", [
      creative.campanha_veiculo_id,
    ]);
    if (rows[0]?.campanha_id) return rows[0].campanha_id;
  }
  if (creative.campanha) {
    const { rows } = await query("SELECT id FROM campanhas WHERE nome = $1", [creative.campanha]);
    if (rows[0]?.id) return rows[0].id;
  }
  return null;
}

// Grava uma linha de auditoria. Uma acao (criacao/exclusao) = 1 linha; uma
// edicao com N campos alterados = N linhas (uma por campo), todas
// auto-descritivas, sem precisar de uma tabela "grupo de edicao" separada.
export async function registrarAcao({
  entidadeTipo,
  entidadeId,
  entidadeNome,
  campanhaId,
  acao,
  campo = null,
  valorAnterior = null,
  valorNovo = null,
  alteradoPor = null,
  origem = "manual",
}) {
  if (!campanhaId) return; // sem campanha resolvida, nao ha onde listar esta acao
  await query(
    `INSERT INTO action_log
      (entidade_tipo, entidade_id, entidade_nome, campanha_id, acao, campo, valor_anterior, valor_novo, alterado_por, origem)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [entidadeTipo, entidadeId ?? null, entidadeNome, campanhaId, acao, campo, valorAnterior, valorNovo, alteradoPor, origem]
  );
}

// Compara camposAntes (estado anterior) com camposDepois (patch recebido) usando
// um mapa "chave tecnica -> rotulo legivel" fornecido pelo chamador -- so grava
// os campos que de fato mudaram e que estao presentes em camposDepois (undefined
// = campo nao foi tocado nesta edicao, nao entra no diff). Valores sao
// convertidos para string para a comparacao/gravacao (arrays viram "a, b, c").
export async function registrarEdicaoCampos({
  entidadeTipo,
  entidadeId,
  entidadeNome,
  campanhaId,
  camposAntes,
  camposDepois,
  alteradoPor,
  labels,
}) {
  if (!campanhaId) return;

  function normaliza(v) {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  }

  for (const [chave, label] of Object.entries(labels)) {
    if (!(chave in camposDepois)) continue;
    const antes = normaliza(camposAntes[chave]);
    const depois = normaliza(camposDepois[chave]);
    if (antes === depois) continue;
    await registrarAcao({
      entidadeTipo,
      entidadeId,
      entidadeNome,
      campanhaId,
      acao: "edicao",
      campo: label,
      valorAnterior: antes || null,
      valorNovo: depois || null,
      alteradoPor,
    });
  }
}

// Lista completa (sem paginacao) do log de uma campanha, mais recente primeiro.
// LEFT JOIN (nao INNER) para nao esconder acoes automaticas, onde alterado_por
// e NULL -- mesmo problema que existia em getStatusHistory (creativesService.js).
export async function listarAcoesPorCampanha(campanhaId) {
  const { rows } = await query(
    `SELECT a.*, u.nome AS alterado_por_nome
     FROM action_log a
     LEFT JOIN users u ON u.id = a.alterado_por
     WHERE a.campanha_id = $1
     ORDER BY a.criado_em DESC`,
    [campanhaId]
  );
  return rows;
}
