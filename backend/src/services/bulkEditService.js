import { query } from "../config/database.js";
import { registrarAcao, resolveCampanhaIdDoCreative } from "./actionLogService.js";

const JANELA_DESFAZER_HORAS = 2;

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

// Operacoes do usuario logado ainda dentro da janela de 2h e nao desfeitas --
// so essas podem aparecer/ser desfeitas. Mais recentes primeiro. Cada operacao
// traz tambem os nomes dos criativos afetados e, para o primeiro deles, o
// detalhamento campo a campo (valor anterior -> valor atual) -- serve como
// amostra representativa do que a edicao mudou, sem sobrecarregar a resposta
// trazendo o detalhamento de todos quando a operacao afeta muitos criativos.
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
    `SELECT s.operation_id, s.creative_id, s.valores_antes, c.*
     FROM bulk_edit_snapshots s
     JOIN creatives c ON c.id = s.creative_id
     WHERE s.operation_id = ANY($1)
     ORDER BY s.id ASC`,
    [operacoes.map((o) => o.id)]
  );

  return operacoes.map((op) => {
    const doOp = snapshots.filter((s) => s.operation_id === op.id);
    const nomesCriativos = doOp.map((s) => s.nome);
    const amostra = doOp[0];
    let detalhamento = [];
    if (amostra) {
      detalhamento = Object.entries(amostra.valores_antes).map(([chave, valorAntes]) => ({
        campo: chave,
        valorAntes,
        valorDepois: amostra[COLUNA_POR_CAMPO[chave]],
      }));
    }
    return { ...op, nomesCriativos, detalhamento };
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
};

// Desfaz uma operacao: valida posse/janela/uso unico (fail-closed em qualquer
// falha), restaura os valores anteriores de cada criativo afetado (so os
// campos que o snapshot guardou), marca a operacao como desfeita e registra
// a reversao no historico normal da campanha (nao fica invisivel).
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
    `SELECT creative_id, valores_antes FROM bulk_edit_snapshots WHERE operation_id = $1`,
    [operationId]
  );

  let restaurados = 0;
  for (const snap of snapshots) {
    const valoresAntes = snap.valores_antes;
    const colunas = Object.keys(valoresAntes).filter((chave) => COLUNA_POR_CAMPO[chave]);
    if (colunas.length === 0) continue;

    const setClauses = colunas.map((chave, i) => `${COLUNA_POR_CAMPO[chave]} = $${i + 2}`);
    const valores = colunas.map((chave) => valoresAntes[chave]);

    const { rows: restaurado } = await query(
      `UPDATE creatives SET ${setClauses.join(", ")}, atualizado_em = now() WHERE id = $1 RETURNING *`,
      [snap.creative_id, ...valores]
    );
    if (restaurado[0]) {
      restaurados += 1;
      const campanhaIdLog = await resolveCampanhaIdDoCreative(restaurado[0]);
      await registrarAcao({
        entidadeTipo: "criativo",
        entidadeId: restaurado[0].id,
        entidadeNome: restaurado[0].nome,
        campanhaId: campanhaIdLog,
        acao: "edicao",
        campo: "Desfazer edição em massa",
        valorNovo: "Revertido para o estado anterior",
        alteradoPor: usuarioId,
      });
    }
  }

  await query(`UPDATE bulk_edit_operations SET desfeita_em = now() WHERE id = $1`, [operationId]);

  return { restaurados };
}
