import { query } from "../config/database.js";
import { getCreativeById } from "./creativesService.js";

// Usuarios que podem ser mencionados num comentario deste criativo: todos os
// "agencia" (sem restricao -- ja veem tudo no resto do sistema) + usuarios
// "veiculo" cujo campo veiculos bate com o vehicle_id do campanha_veiculo_id
// do criativo E que tenham acesso_matriz=true nesse vinculo (mesmo escopo
// usado para visibilidade na Matriz, ver vinculoIdsComAcessoMatriz em
// creativesService.js -- aqui e a direcao reversa: dado um criativo, quem
// pode ve-lo). Criativos legados sem campanha_veiculo_id (so texto solto
// creatives.veiculo) so retornam agencia, ja que nao ha vinculo pra resolver
// o acesso_matriz.
export async function listMencionaveisPorCreative(creativeId) {
  const creative = await getCreativeById(creativeId);
  if (!creative) return [];

  const { rows: agencia } = await query(
    "SELECT id, nome, papel FROM users WHERE papel = 'agencia' AND ativo = true ORDER BY nome ASC"
  );

  if (!creative.campanha_veiculo_id) return agencia;

  const { rows: veiculo } = await query(
    `SELECT u.id, u.nome, u.papel
     FROM campanha_veiculos cv
     JOIN vehicles v ON v.id = cv.vehicle_id
     JOIN users u ON u.papel = 'veiculo' AND u.ativo = true AND u.veiculos @> ARRAY[v.nome]
     WHERE cv.id = $1 AND cv.acesso_matriz = true
     ORDER BY u.nome ASC`,
    [creative.campanha_veiculo_id]
  );

  return [...agencia, ...veiculo];
}

export async function listComentariosPorCreative(creativeId) {
  const { rows } = await query(
    `SELECT c.*, u.nome AS autor_nome
     FROM creative_comments c
     JOIN users u ON u.id = c.autor_id
     WHERE c.creative_id = $1
     ORDER BY c.criado_em ASC`,
    [creativeId]
  );
  return rows;
}

// So o proprio autor pode editar/excluir -- lanca 403 se outro usuario tentar
// (o caller/rota converte esse statusCode num erro HTTP apropriado).
async function checarAutoria(commentId, userId) {
  const { rows } = await query("SELECT autor_id FROM creative_comments WHERE id = $1", [commentId]);
  if (!rows[0]) return null;
  if (rows[0].autor_id !== userId) {
    const err = new Error("Você só pode editar ou excluir seus próprios comentários");
    err.statusCode = 403;
    throw err;
  }
  return rows[0];
}

export async function editarComentario(commentId, userId, novoTexto) {
  await checarAutoria(commentId, userId);
  const { rows } = await query(
    `UPDATE creative_comments SET texto = $2, editado_em = now() WHERE id = $1 RETURNING *`,
    [commentId, novoTexto]
  );
  return rows[0] || null;
}

export async function excluirComentario(commentId, userId) {
  const existente = await checarAutoria(commentId, userId);
  if (!existente) return false;
  await query("DELETE FROM creative_comments WHERE id = $1", [commentId]);
  return true;
}

// Cria o comentario e uma linha de mencao por usuario mencionado -- nunca
// confia cegamente na lista de ids que veio do cliente: refaz a checagem de
// "quem pode ser mencionado" no servidor e silenciosamente ignora qualquer
// id fora dessa lista (fail-closed, sem erro pro usuario -- ele so nao
// consegue mencionar quem nao deveria, sem precisar saber o motivo exato).
export async function criarComentario({ creativeId, autorId, texto, mencionadosIds = [] }) {
  const { rows } = await query(
    `INSERT INTO creative_comments (creative_id, autor_id, texto) VALUES ($1, $2, $3) RETURNING *`,
    [creativeId, autorId, texto]
  );
  const comentario = rows[0];

  const mencionaveis = await listMencionaveisPorCreative(creativeId);
  const idsValidos = new Set(mencionaveis.map((u) => u.id));
  const idsParaMencionar = [...new Set(mencionadosIds)].filter((id) => idsValidos.has(id) && id !== autorId);

  for (const usuarioId of idsParaMencionar) {
    await query(
      `INSERT INTO comment_mentions (comment_id, usuario_mencionado_id) VALUES ($1, $2)`,
      [comentario.id, usuarioId]
    );
  }

  return comentario;
}

// Notificacoes de mencao do usuario logado -- inclui campanha_id (resolvido
// via campanha_veiculos, mesmo padrao de resolveCampanhaIdDoCreative em
// actionLogService.js) para o frontend poder navegar direto pra campanha
// certa ao clicar na notificacao. Trecho do comentario limitado a 80
// caracteres para a previa no sino.
export async function listNotificacoesMencao(userId) {
  const { rows } = await query(
    `SELECT
        m.id AS mention_id, m.lido, m.criado_em,
        c.id AS comment_id, LEFT(c.texto, 80) AS trecho,
        cr.id AS creative_id, cr.nome AS creative_nome,
        au.nome AS autor_nome,
        COALESCE(cv.campanha_id, (SELECT id FROM campanhas WHERE nome = cr.campanha)) AS campanha_id
     FROM comment_mentions m
     JOIN creative_comments c ON c.id = m.comment_id
     JOIN creatives cr ON cr.id = c.creative_id
     JOIN users au ON au.id = c.autor_id
     LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
     WHERE m.usuario_mencionado_id = $1
     ORDER BY m.criado_em DESC
     LIMIT 30`,
    [userId]
  );
  return rows;
}

export async function marcarNotificacaoLida(mentionId, userId) {
  const { rowCount } = await query(
    "UPDATE comment_mentions SET lido = true WHERE id = $1 AND usuario_mencionado_id = $2",
    [mentionId, userId]
  );
  return rowCount > 0;
}
