import { query } from "../config/database.js";
import { registrarAcao, resolveCampanhaIdDoCreative } from "./actionLogService.js";

const JANELA_DESFAZER_HORAS = 2;

// Compara valor "antes" (vindo do JSON salvo -- string/array/boolean puro) com
// valor "depois" (vindo direto da linha do banco -- pode ser Date, array do
// pg, etc) de forma tolerante o suficiente pra nao acusar diferenca onde nao
// ha uma de verdade. Normaliza pra string em ambos os lados como base de
// comparacao, tratando Date/array/null/undefined/booleanos-como-string.
function valoresIguais(a, b) {
  const normalizar = (v) => {
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return [...v].sort().join(",");
    if (v === true || v === "true") return "true";
    if (v === false || v === "false") return "false";
    return String(v);
  };
  return normalizar(a) === normalizar(b);
}

// Cria a operacao (1 linha) e os snapshots (1 por criativo afetado) de uma
// edicao em massa, numa unica escrita apos o loop de updates ja ter rodado.
// snapshots: [{ creativeId, valoresAntes }] -- valoresAntes so contem as
// chaves que o patch de fato tocou (mesmo formato usado pelo diff do
// action_log), pra restaurar exatamente o que foi mudado, nada mais.
export async function registrarOperacaoBulk(usuarioId, camposAlterados, snapshots) {
  if (snapshots.length === 0) return null;

  const { rows } = await query(
    `INSERT INTO bulk_edit_operations (usuario_id, campos_alterados, total_criativos, expira_em)
     VALUES ($1, $2, $3, now() + interval '${JANELA_DESFAZER_HORAS} hours')
     RETURNING id`,
    [usuarioId, camposAlterados, snapshots.length]
  );
  const operationId = rows[0].id;

  for (const s of snapshots) {
    await query(
      `INSERT INTO bulk_edit_snapshots (operation_id, creative_id, valores_antes) VALUES ($1, $2, $3)`,
      [operationId, s.creativeId, JSON.stringify(s.valoresAntes)]
    );
  }

  return operationId;
}

// Operacoes do usuario logado ainda dentro da janela de 2h e nao desfeitas
// (a nivel de operacao) -- mais recentes primeiro. Cada operacao traz a
// lista completa de criativos afetados (snapshot.id, nome, campo a campo
// valor anterior -> atual, e se aquele item especifico ja foi desfeito),
// pra o painel poder desfazer o lote inteiro OU so 1 criativo dentro dele.
export async function listarOperacoesBulk(usuarioId) {
  const { rows: operacoes } = await query(
    `SELECT id, campos_alterados, total_criativos, criado_em, expira_em
     FROM bulk_edit_operations
     WHERE usuario_id = $1 AND expira_em > now() AND desfeita_em IS NULL
     ORDER BY criado_em DESC`,
    [usuarioId]
  );
  if (operacoes.length === 0) return [];

  const { rows: snapshots } = await query(
    `SELECT s.id AS snapshot_id, s.operation_id, s.creative_id, s.valores_antes, s.desfeita_em, c.*
     FROM bulk_edit_snapshots s
     JOIN creatives c ON c.id = s.creative_id
     WHERE s.operation_id = ANY($1)
     ORDER BY s.id ASC`,
    [operacoes.map((o) => o.id)]
  );

  return operacoes.map((op) => {
    const itens = snapshots
      .filter((s) => s.operation_id === op.id)
      .map((s) => ({
        snapshotId: s.snapshot_id,
        creativeId: s.creative_id,
        nome: s.nome,
        desfeito: s.desfeita_em !== null,
        // So os campos onde o valor de fato mudou -- edicao individual pelo
        // formulario completo (CreativeFormModal) sempre reenvia TODOS os
        // campos, entao o snapshot captura todos como "tocados" mesmo quando
        // antes/depois sao identicos (ex: reenviar o mesmo Formato). Sem esse
        // filtro, o painel mostrava uma lista enorme de "X -> X" sem sentido.
        campos: Object.entries(s.valores_antes)
          .map(([chave, valorAntes]) => ({ campo: chave, valorAntes, valorDepois: s[COLUNA_POR_CAMPO[chave]] }))
          .filter((c) => !valoresIguais(c.valorAntes, c.valorDepois)),
      }));
    return { ...op, itens };
  });
}

// Mapeamento chave do patch (camelCase, usado no frontend/service) -> coluna
// real da tabela creatives. So os campos que o BulkEditModal de fato oferece
// (ver CAMPOS_EDICAO_EM_MASSA em creativesService.js) precisam estar aqui --
// um campo que aparecer num snapshot antigo mas nao mapeado aqui e ignorado
// (fail-closed, nunca escreve numa coluna desconhecida).
export const COLUNA_POR_CAMPO = {
  status: "status",
  campanha: "campanha",
  veiculo: "veiculo",
  plataforma: "plataforma",
  tiposCompra: "tipos_compra",
  campaignName: "campaign_name",
  conjunto: "conjunto",
  formato: "formato",
  posicionamento: "posicionamento",
  periodoInicio: "periodo_inicio",
  periodoFim: "periodo_fim",
  urlDestino: "url_destino",
  impulsionado: "impulsionado",
  segmentacao: "segmentacao",
  titulo: "titulo",
  descricao: "descricao",
  observacoes: "observacoes",
  ehPerformance: "eh_performance",
  orcamentoProjetado: "orcamento_projetado",
  formularioNativo: "formulario_nativo",
  observacoesFormularioNativo: "observacoes_formulario_nativo",
};

// Restaura os valores_antes de 1 snapshot no creativo correspondente, marca
// o snapshot como desfeito e registra no historico normal da campanha (nao
// fica invisivel). Reaproveitada tanto pra desfazer a operacao inteira
// (loop abaixo) quanto pra desfazer so 1 item dentro dela.
async function restaurarSnapshot(snap, usuarioId) {
  const valoresAntes = snap.valores_antes;
  const colunas = Object.keys(valoresAntes).filter((chave) => COLUNA_POR_CAMPO[chave]);
  if (colunas.length === 0) return false;

  const setClauses = colunas.map((chave, i) => `${COLUNA_POR_CAMPO[chave]} = $${i + 2}`);
  const valores = colunas.map((chave) => valoresAntes[chave]);

  const { rows: restaurado } = await query(
    `UPDATE creatives SET ${setClauses.join(", ")}, atualizado_em = now() WHERE id = $1 RETURNING *`,
    [snap.creative_id, ...valores]
  );
  if (!restaurado[0]) return false;

  await query(`UPDATE bulk_edit_snapshots SET desfeita_em = now() WHERE id = $1`, [snap.id]);

  const campanhaIdLog = await resolveCampanhaIdDoCreative(restaurado[0]);
  await registrarAcao({
    entidadeTipo: "criativo",
    entidadeId: restaurado[0].id,
    entidadeNome: restaurado[0].nome,
    campanhaId: campanhaIdLog,
    acao: "edicao",
    campo: "Desfazer edição",
    valorNovo: "Revertido para o estado anterior",
    alteradoPor: usuarioId,
  });
  return true;
}

// Desfaz uma operacao inteira: valida posse/janela/uso unico (fail-closed em
// qualquer falha), restaura cada criativo ainda nao desfeito individualmente
// dentro dela (pula os que ja foram revertidos 1 a 1 via desfazerItemBulk),
// e marca a operacao como desfeita.
export async function desfazerOperacaoBulk(operationId, usuarioId) {
  const { rows: opRows } = await query(
    `SELECT * FROM bulk_edit_operations WHERE id = $1 AND usuario_id = $2`,
    [operationId, usuarioId]
  );
  const operacao = opRows[0];
  if (!operacao) {
    const err = new Error("Operação não encontrada");
    err.statusCode = 404;
    throw err;
  }
  if (operacao.desfeita_em) {
    const err = new Error("Esta edição já foi desfeita anteriormente");
    err.statusCode = 400;
    throw err;
  }
  if (new Date(operacao.expira_em) <= new Date()) {
    const err = new Error("O prazo de 2 horas para desfazer esta edição já passou");
    err.statusCode = 400;
    throw err;
  }

  const { rows: snapshots } = await query(
    `SELECT id, creative_id, valores_antes FROM bulk_edit_snapshots WHERE operation_id = $1 AND desfeita_em IS NULL`,
    [operationId]
  );

  let restaurados = 0;
  for (const snap of snapshots) {
    if (await restaurarSnapshot(snap, usuarioId)) restaurados += 1;
  }

  await query(`UPDATE bulk_edit_operations SET desfeita_em = now() WHERE id = $1`, [operationId]);

  return { restaurados };
}

// Desfaz so 1 criativo dentro de uma edicao em massa, sem reverter os
// demais nem marcar a operacao inteira como desfeita -- fail-closed nas
// mesmas condicoes de desfazerOperacaoBulk (posse via join com a operacao,
// janela de 2h, item ja desfeito antes). Se esse for o ultimo item ainda
// pendente da operacao, marca a operacao inteira como desfeita tambem (nao
// deixa uma operacao "vazia" aparecendo pra sempre no painel).
export async function desfazerItemBulk(snapshotId, usuarioId) {
  const { rows: snapRows } = await query(
    `SELECT s.*, o.usuario_id, o.expira_em, o.desfeita_em AS operacao_desfeita_em
     FROM bulk_edit_snapshots s
     JOIN bulk_edit_operations o ON o.id = s.operation_id
     WHERE s.id = $1`,
    [snapshotId]
  );
  const snap = snapRows[0];
  if (!snap || snap.usuario_id !== usuarioId) {
    const err = new Error("Item não encontrado");
    err.statusCode = 404;
    throw err;
  }
  if (snap.desfeita_em || snap.operacao_desfeita_em) {
    const err = new Error("Este item já foi desfeito anteriormente");
    err.statusCode = 400;
    throw err;
  }
  if (new Date(snap.expira_em) <= new Date()) {
    const err = new Error("O prazo de 2 horas para desfazer esta edição já passou");
    err.statusCode = 400;
    throw err;
  }

  const ok = await restaurarSnapshot(snap, usuarioId);

  const { rows: pendentes } = await query(
    `SELECT COUNT(*)::int AS total FROM bulk_edit_snapshots WHERE operation_id = $1 AND desfeita_em IS NULL`,
    [snap.operation_id]
  );
  if (pendentes[0].total === 0) {
    await query(`UPDATE bulk_edit_operations SET desfeita_em = now() WHERE id = $1`, [snap.operation_id]);
  }

  return { restaurado: ok };
}
