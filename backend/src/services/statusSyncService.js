import { query } from "../config/database.js";
import { getRealizadoDetalhado, getRealizadoDetalhadoMulti } from "./sheetsClient.js";
import { updateStatusSistema } from "./creativesService.js";
import { linhasCasadas, getSubcanaisPorPlataforma } from "../utils/creativeMatch.js";

// Status que participam da automacao -- os demais (Pausado, Aprovado, Em aprovacao,
// Aguardando implementacao, Com erro, Nao registrado) sao decisoes manuais que o job
// nunca sobrescreve. "Com erro" NAO tem mais gatilho automatico -- so atribuido
// manualmente por um usuario que identificou um problema real.
const STATUS_PROGRAMADO = "Programado";
const STATUS_ATIVO = "Ativo";
const STATUS_FINALIZADO = "Finalizado";
const STATUS_PAUSADO = "Pausado";
const STATUSES_ELEGIVEIS = [STATUS_PROGRAMADO, STATUS_ATIVO];

const DIAS_TOLERANCIA_SEM_DADOS = 3;

function hoje() {
  return new Date(new Date().toDateString());
}

function diasAtras(n) {
  const d = hoje();
  d.setDate(d.getDate() - n);
  return d;
}

// Decide a proxima transicao de status para um criativo elegivel, dado o conjunto de
// linhas da planilha que casaram com ele. Retorna null quando nao ha mudanca a fazer.
function decidirTransicao(creative, linhas) {
  const temDadosComInvestimento = linhas.some((l) => l.investimento > 0 || l.impressoes > 0);
  const dataMaisRecente = linhas.reduce((max, l) => (l.data > max ? l.data : max), "");
  const periodoFim = creative.periodo_fim ? new Date(creative.periodo_fim) : null;
  const periodoFimVencido = periodoFim && periodoFim < hoje();

  if (creative.status === STATUS_PROGRAMADO) {
    if (temDadosComInvestimento) return STATUS_ATIVO;
    return null;
  }

  if (creative.status === STATUS_ATIVO) {
    if (periodoFimVencido) return STATUS_FINALIZADO;

    // "Pausado": ja estava ativo (ou seja, ja teve pelo menos 1 dia com dados no
    // passado, e so por isso saiu de Programado) mas ficou sem nenhuma linha com
    // investimento/impressoes nos ultimos dias -- sinal de que algo parou de rodar.
    // So avalia depois da primeira sincronizacao (ultima_sincronizacao_em
    // preenchida), para nao marcar como parado no mesmissimo ciclo em que acabou de
    // virar Ativo.
    const janela = diasAtras(DIAS_TOLERANCIA_SEM_DADOS).toISOString().slice(0, 10);
    const semDadosRecentes = !dataMaisRecente || dataMaisRecente < janela;
    if (semDadosRecentes && creative.ultima_sincronizacao_em) return STATUS_PAUSADO;
    return null;
  }

  return null;
}

async function buscarCreativosElegiveis(campanhaId) {
  if (campanhaId) {
    const { rows } = await query(
      `SELECT cr.* FROM creatives cr
       LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
       WHERE cr.status = ANY($1) AND cr.ad_name IS NOT NULL AND cr.ad_name <> ''
         AND (cv.campanha_id = $2
              OR (cr.campanha_veiculo_id IS NULL AND cr.campanha = (SELECT nome FROM campanhas WHERE id = $2)))`,
      [STATUSES_ELEGIVEIS, campanhaId]
    );
    return rows;
  }
  // Sem campanha especifica (cron): varre so campanhas ainda ativas, para nao crescer
  // sem necessidade com milhares de campanhas ja finalizadas/canceladas no sistema.
  const { rows } = await query(
    `SELECT cr.* FROM creatives cr
     LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
     LEFT JOIN campanhas c ON c.id = cv.campanha_id
     WHERE cr.status = ANY($1) AND cr.ad_name IS NOT NULL AND cr.ad_name <> ''
       AND (c.status IS NULL OR c.status NOT IN ('finalizado', 'cancelado'))`,
    [STATUSES_ELEGIVEIS]
  );
  return rows;
}

// Ids de todas as campanhas ainda ativas (nao finalizadas/canceladas) -- usado pelo
// cron (sem campanhaId especifica) para buscar a serie diaria de cada campanha em
// sua propria planilha vinculada e mesclar via getRealizadoDetalhadoMulti. Mesmo
// filtro de status usado em buscarCreativosElegiveis, so que aqui e sobre campanhas,
// nao criativos.
async function idsCampanhasAtivas() {
  const { rows } = await query(
    `SELECT id FROM campanhas WHERE status NOT IN ('finalizado', 'cancelado')`
  );
  return rows.map((r) => r.id);
}

// Varre criativos elegiveis (Programado/Ativo), casa cada um contra a planilha
// de Realizado e aplica a transicao de status correspondente, gravando origem
// 'automatico' no historico. Chamada tanto pelo botao manual quanto pelo cron.
export async function syncStatusCriativos({ campanhaId = null, origem = "manual", disparadoPor = null } = {}) {
  const { rows: runRows } = await query(
    `INSERT INTO status_sync_runs (origem, disparado_por, campanha_id)
     VALUES ($1, $2, $3) RETURNING id`,
    [origem, disparadoPor, campanhaId]
  );
  const runId = runRows[0].id;

  let avaliados = 0;
  let alterados = 0;

  try {
    const creatives = await buscarCreativosElegiveis(campanhaId);
    const [linhasPlanilha, subcanaisPorPlataforma] = await Promise.all([
      campanhaId ? getRealizadoDetalhado(campanhaId) : getRealizadoDetalhadoMulti(await idsCampanhasAtivas()),
      getSubcanaisPorPlataforma(),
    ]);

    for (const creative of creatives) {
      avaliados += 1;
      const linhas = linhasCasadas(linhasPlanilha, creative, subcanaisPorPlataforma);
      const novoStatus = decidirTransicao(creative, linhas);

      if (novoStatus && novoStatus !== creative.status) {
        await updateStatusSistema(creative.id, novoStatus);
        alterados += 1;
      }

      await query("UPDATE creatives SET ultima_sincronizacao_em = now() WHERE id = $1", [creative.id]);
    }

    await query(
      `UPDATE status_sync_runs SET finalizado_em = now(), criativos_avaliados = $2, criativos_alterados = $3
       WHERE id = $1`,
      [runId, avaliados, alterados]
    );

    return { criativosAvaliados: avaliados, criativosAlterados: alterados };
  } catch (err) {
    await query(
      `UPDATE status_sync_runs SET finalizado_em = now(), criativos_avaliados = $2, criativos_alterados = $3, erro = $4
       WHERE id = $1`,
      [runId, avaliados, alterados, err.message || String(err)]
    );
    throw err;
  }
}
