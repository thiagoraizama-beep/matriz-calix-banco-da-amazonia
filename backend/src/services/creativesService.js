import { query } from "../config/database.js";
import { getCloudinaryClient } from "../config/cloudinary.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { scopeVeiculoFilter, scopeCampanhaFilter } from "../utils/scopeFilter.js";
import { registrarAcao, registrarEdicaoCampos, resolveCampanhaIdDoCreative } from "./actionLogService.js";

// Rotulos legiveis dos campos editaveis de um criativo, usados pelo log de
// auditoria (registrarEdicaoCampos) para descrever "Campo: antes -> depois"
// de forma legivel para quem revisa o historico. So os campos de conteudo do
// anuncio entram aqui -- ids de armazenamento (cloudinary_public_id etc) e
// timestamps internos ficam de fora de proposito.
const LABELS_CAMPOS_CREATIVE = {
  campanha: "Campanha",
  veiculo: "Veículo",
  plataforma: "Plataforma",
  tiposCompra: "Tipo de compra",
  campaignName: "Campaign Name",
  conjunto: "Ad Group",
  formato: "Formato",
  periodoInicio: "Início do período",
  periodoFim: "Fim do período",
  urlDestino: "URL de destino",
  impulsionado: "Tipo de publicação",
  linkPostagem: "Link da postagem",
  segmentacao: "Segmentação",
  titulo: "Título",
  posicionamento: "Posicionamento",
  descricao: "Descrição",
  observacoes: "Observações",
  ehPerformance: "Performance",
  orcamentoProjetado: "Orçamento projetado",
};

export const STATUSES = [
  "Não registrado",
  "Em aprovação",
  "Aprovado",
  "Aguardando implementação",
  "Programado",
  "Ativo",
  "Pausado",
  "Com erro",
  "Finalizado",
];

export const STATUSES_VEICULO = [
  "Programado",
  "Ativo",
  "Pausado",
  "Com erro",
  "Finalizado",
];

function veiculosVisiveis(user) {
  if (user.papel === "veiculo") return scopeVeiculoFilter(user, null);
  return null;
}

// Ids dos vinculos (campanha_veiculos) do usuario que tem acesso a Matriz de Conteudo.
function vinculoIdsComAcessoMatriz(user) {
  const escopos = Array.isArray(user.escopos) ? user.escopos : [];
  return escopos.filter((e) => e.acessoMatriz === true).map((e) => e.campanhaVeiculoId);
}

export async function listCreatives(user) {
  const veiculos = veiculosVisiveis(user);
  if (veiculos) {
    const vinculoIds = vinculoIdsComAcessoMatriz(user);
    const campanhas = scopeCampanhaFilter(user, null);
    if (campanhas) {
      // Isolamento por vinculo: criativos com campanha_veiculo_id so aparecem para
      // quem tem aquele vinculo especifico (com acessoMatriz). Criativos legados
      // (campanha_veiculo_id nulo) caem no fallback por string veiculo+campanha.
      const { rows } = await query(
        `SELECT * FROM creatives
         WHERE (campanha_veiculo_id = ANY($1))
            OR (campanha_veiculo_id IS NULL AND veiculo = ANY($2) AND campanha = ANY($3))
         ORDER BY criado_em DESC`,
        [vinculoIds, veiculos, campanhas]
      );
      return rows;
    }
    const { rows } = await query(
      `SELECT * FROM creatives
       WHERE (campanha_veiculo_id = ANY($1))
          OR (campanha_veiculo_id IS NULL AND veiculo = ANY($2))
       ORDER BY criado_em DESC`,
      [vinculoIds, veiculos]
    );
    return rows;
  }
  const { rows } = await query("SELECT * FROM creatives ORDER BY criado_em DESC");
  return rows;
}

// Criativos com status "Aguardando implementação" de TODAS as campanhas que o
// usuario tem acesso, para a tela global de triagem "A implementar". Antes filtrava
// por periodo_inicio = hoje/amanha, mas essa data se mostrou pouco confiavel na
// pratica (periodos mudam) -- o criterio agora e puramente o status, que reflete uma
// decisao explicita de que o criativo esta pronto e esperando ser implementado.
// Mesma resolucao de escopo de listCreatives, so acrescentando o filtro de status e
// o JOIN para trazer o nome/id da campanha de origem (necessario aqui pois a lista
// cruza campanhas — listCreatives nao precisa disso porque o caller ja sabe em que
// campanha esta). Criativos legados (campanha_veiculo_id nulo) resolvem a campanha
// pelo texto solto creatives.campanha via subquery, mesmo fallback usado no resto
// do arquivo.
export async function listCreativesAImplementar(user) {
  const veiculos = veiculosVisiveis(user);
  const selectComCampanha = `
    SELECT cr.*,
           COALESCE(c.id, (SELECT id FROM campanhas WHERE nome = cr.campanha)) AS campanha_id_ref,
           COALESCE(c.nome, cr.campanha) AS campanha_nome_ref
    FROM creatives cr
    LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
    LEFT JOIN campanhas c ON c.id = cv.campanha_id
  `;

  if (veiculos) {
    const vinculoIds = vinculoIdsComAcessoMatriz(user);
    const campanhas = scopeCampanhaFilter(user, null);
    if (campanhas) {
      const { rows } = await query(
        `${selectComCampanha}
         WHERE cr.status = 'Aguardando implementação'
           AND ((cr.campanha_veiculo_id = ANY($1))
                OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2) AND cr.campanha = ANY($3)))
         ORDER BY cr.atualizado_em ASC`,
        [vinculoIds, veiculos, campanhas]
      );
      return rows;
    }
    const { rows } = await query(
      `${selectComCampanha}
       WHERE cr.status = 'Aguardando implementação'
         AND ((cr.campanha_veiculo_id = ANY($1))
              OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2)))
       ORDER BY cr.atualizado_em ASC`,
      [vinculoIds, veiculos]
    );
    return rows;
  }

  const { rows } = await query(
    `${selectComCampanha}
     WHERE cr.status = 'Aguardando implementação'
     ORDER BY cr.atualizado_em ASC`
  );
  return rows;
}

// Criativos com status "Com erro" de TODAS as campanhas que o usuario tem acesso --
// usado pelo sino de notificacoes para alertar sobre problemas que exigem acao
// manual (esse status nao tem mais gatilho automatico, so e atribuido por um
// usuario que identificou um problema real). Mesmo padrao de escopo/JOIN de
// listCreativesAImplementar.
export async function listCreativesComErro(user) {
  const veiculos = veiculosVisiveis(user);
  const selectComCampanha = `
    SELECT cr.*,
           COALESCE(c.id, (SELECT id FROM campanhas WHERE nome = cr.campanha)) AS campanha_id_ref,
           COALESCE(c.nome, cr.campanha) AS campanha_nome_ref
    FROM creatives cr
    LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
    LEFT JOIN campanhas c ON c.id = cv.campanha_id
  `;

  if (veiculos) {
    const vinculoIds = vinculoIdsComAcessoMatriz(user);
    const campanhas = scopeCampanhaFilter(user, null);
    if (campanhas) {
      const { rows } = await query(
        `${selectComCampanha}
         WHERE cr.status = 'Com erro'
           AND ((cr.campanha_veiculo_id = ANY($1))
                OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2) AND cr.campanha = ANY($3)))
         ORDER BY cr.atualizado_em DESC`,
        [vinculoIds, veiculos, campanhas]
      );
      return rows;
    }
    const { rows } = await query(
      `${selectComCampanha}
       WHERE cr.status = 'Com erro'
         AND ((cr.campanha_veiculo_id = ANY($1))
              OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2)))
       ORDER BY cr.atualizado_em DESC`,
      [vinculoIds, veiculos]
    );
    return rows;
  }

  const { rows } = await query(
    `${selectComCampanha}
     WHERE cr.status = 'Com erro'
     ORDER BY cr.atualizado_em DESC`
  );
  return rows;
}

// Lista os criativos de UMA campanha especifica (usado pela nova Matriz por
// campanha, que nunca carrega todos os criativos do sistema de uma vez -- o volume
// esperado e de milhares de campanhas). Mesmo isolamento de escopo de listCreatives,
// com filtro adicional por campanha: criativos "novos" (campanha_veiculo_id
// preenchido) casam via o vinculo campanha_veiculos.campanha_id; criativos legados
// (campanha_veiculo_id nulo) caem no fallback pelo texto solto creatives.campanha.
// Inclui acesso_analise_criativo/plataformas_analise_criativo do vinculo (quando
// existir) para o frontend decidir, por criativo, se deve tentar buscar performance
// ao abrir o detalhe -- fail-closed: criativo legado sem campanha_veiculo_id (JOIN
// nao resolve) vem com esses campos NULL, tratado como sem acesso.
export async function listCreativesByCampanha(user, campanhaId) {
  const veiculos = veiculosVisiveis(user);
  if (veiculos) {
    const vinculoIds = vinculoIdsComAcessoMatriz(user);
    const { rows } = await query(
      `SELECT cr.*, cv.acesso_analise_criativo, cv.plataformas_analise_criativo
       FROM creatives cr
       LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
       WHERE (cr.campanha_veiculo_id = ANY($1) AND cv.campanha_id = $2)
          OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($3)
              AND cr.campanha = (SELECT nome FROM campanhas WHERE id = $2))
       ORDER BY cr.criado_em DESC`,
      [vinculoIds, campanhaId, veiculos]
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT cr.*, cv.acesso_analise_criativo, cv.plataformas_analise_criativo
     FROM creatives cr
     LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
     WHERE cv.campanha_id = $1
        OR (cr.campanha_veiculo_id IS NULL AND cr.campanha = (SELECT nome FROM campanhas WHERE id = $1))
     ORDER BY cr.criado_em DESC`,
    [campanhaId]
  );
  return rows;
}

// Cruza um Ad Name da planilha com o criativo cadastrado na Matriz de Conteudo,
// do mais especifico para o mais permissivo -- evita casar o criativo de um
// vendor/campanha com o Ad Name (as vezes repetido) de outro:
// 1. campanha + plataforma(veiculo) + modeloCompra + formato
// 2. campanha + plataforma + modeloCompra (sem formato)
// 3. campanha + plataforma (sem modeloCompra/formato -- dado incompleto na planilha)
// 4. plataforma + formato (sem campanha -- fallback para dados legados/fora do fluxo)
// "veiculo" aqui sempre significou a PLATAFORMA (Meta Ads etc), nao o vendor real
// (Go On Ad Group) -- essa e a granularidade disponivel, o vendor real so e isolado
// de fato pelo campanha_veiculo_id (Etapa 5 do isolamento por vinculo).
// Roda uma tier de busca e so retorna resultado quando ha exatamente 1 match --
// se vierem 2+ (ex: mesmo Ad Name cadastrado em Feed e Stories na mesma campanha)
// e esta tier nao filtra por formato, e ambiguo demais para escolher um dos dois
// sem risco de mostrar o nome/formato errado -- melhor deixar sem match (a proxima
// tier mais especifica, ou a ausencia de match, resolve isso do lado do caller).
async function matchUnico(sql, params) {
  const { rows } = await query(sql, params);
  return rows.length === 1 ? rows[0] : null;
}

// Cruzamento estrito: Ad Name + Plataforma + Veiculo(vendor real) + Campanha +
// Modelo de Compra + Formato/Posicionamento, todos vindos da linha da planilha.
// Sem qualquer um desses campos, ou sem match unico ao mesmo tempo, nao ha match --
// nenhum fallback mais permissivo, para nao arriscar mostrar o criativo errado
// (ex: cadastro em Stories aparecendo para uma linha de Feed, ou de um vendor
// aparecendo para outro).
// plataforma (ex: "Meta Ads") casa com creatives.plataforma; vendedor (ex: "Go On Ad
// Group", vindo da coluna "Veiculo" da planilha) casa com creatives.veiculo, que e
// como o formulario de cadastro da Matriz salva o vendor selecionado.
// Formato comparado sem diferenciar maiusculas/minusculas (planilha manda "FEED",
// cadastro tem "Feed").
export async function findCreativeByAdName(adName, plataforma, vendedor, formato, campanha, modeloCompra) {
  if (!adName || !plataforma || !vendedor || !formato || !campanha || !modeloCompra) return null;
  const normalized = adName.replace(/\s+/g, " ").trim();
  const adNameMatch = "REGEXP_REPLACE(ad_name, '\\s+', ' ', 'g') = $1";

  return matchUnico(
    `SELECT * FROM creatives WHERE ${adNameMatch} AND plataforma = $2 AND veiculo = $3 AND campanha = $4 AND $5 = ANY(tipos_compra) AND UPPER(formato) = UPPER($6)`,
    [normalized, plataforma, vendedor, campanha, modeloCompra, formato]
  );
}

export async function getCreativeById(id) {
  const { rows } = await query("SELECT * FROM creatives WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function createCreative({
  file, cloudinaryUrl, cloudinaryPublicId, tipoMidia: tipoMidiaParam,
  nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
  periodoInicio, periodoFim, veiculo, plataforma, formato, posicionamento,
  urlDestino, impulsionado, segmentacao, titulo, tiposCompra, criadoPor,
  campanhaVeiculoId, linkPostagem, ehPerformance, orcamentoProjetado,
}) {
  // "Impulsionado" parte de um post ja publicado organicamente -- nesse caso o
  // arquivo e opcional (o link da postagem substitui o upload); "Dark Post" nao
  // existe como post organico, entao continua exigindo arquivo (validado na rota).
  let publicId = null, secureUrl = null, tipoMidia = null;
  if (file) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_CREATIVES_FOLDER);
    publicId = upload.public_id;
    secureUrl = upload.secure_url;
    tipoMidia = upload.resource_type === "video" ? "video" : "image";
  } else if (cloudinaryUrl) {
    publicId = cloudinaryPublicId;
    secureUrl = cloudinaryUrl;
    tipoMidia = tipoMidiaParam || "image";
  }

  const { rows } = await query(
    `INSERT INTO creatives
      (nome, ad_name, campanha, campaign_name, conjunto, descricao, observacoes,
       periodo_inicio, periodo_fim, veiculo, plataforma, formato, posicionamento,
       url_destino, impulsionado, segmentacao, titulo, tipos_compra,
       cloudinary_public_id, cloudinary_url, tipo_midia, criado_por, campanha_veiculo_id,
       link_postagem, eh_performance, orcamento_projetado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     RETURNING *`,
    [
      nome, adName?.trim() || null, campanha, campaignName || null, conjunto || null,
      descricao || null, observacoes || null, periodoInicio || null, periodoFim || null,
      veiculo, plataforma || null, formato || null, posicionamento || null,
      urlDestino || null, impulsionado !== false, segmentacao || null, titulo || null,
      tiposCompra?.length ? tiposCompra : [],
      publicId, secureUrl, tipoMidia, criadoPor, campanhaVeiculoId || null,
      linkPostagem || null,
      ehPerformance === true || ehPerformance === "true",
      ehPerformance ? (orcamentoProjetado || null) : null,
    ]
  );
  const creative = rows[0];

  const campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
  await registrarAcao({
    entidadeTipo: "criativo",
    entidadeId: creative.id,
    entidadeNome: creative.nome,
    campanhaId: campanhaIdLog,
    acao: "criacao",
    alteradoPor: criadoPor,
  });

  return creative;
}

export async function updateCreative(id, {
  file,
  nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
  periodoInicio, periodoFim, veiculo, plataforma, formato, posicionamento,
  urlDestino, impulsionado, segmentacao, titulo, tiposCompra, campanhaVeiculoId,
  linkPostagem, ehPerformance, orcamentoProjetado,
}, alteradoPor = null) {
  // Sempre busca o estado anterior (nao so quando ha arquivo novo) -- usado
  // tanto para a limpeza de midia antiga quanto para o diff do log de auditoria.
  const creativeAntigo = await getCreativeById(id);

  let midiaFields = { publicId: null, secureUrl: null, tipoMidia: null };
  if (file) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_CREATIVES_FOLDER);
    midiaFields = {
      publicId: upload.public_id,
      secureUrl: upload.secure_url,
      tipoMidia: upload.resource_type === "video" ? "video" : "image",
    };
  }

  const { rows } = await query(
    `UPDATE creatives SET
      nome = COALESCE($2, nome),
      ad_name = COALESCE($3, ad_name),
      campanha = COALESCE($4, campanha),
      campaign_name = COALESCE($5, campaign_name),
      conjunto = COALESCE($6, conjunto),
      descricao = COALESCE($7, descricao),
      observacoes = COALESCE($8, observacoes),
      periodo_inicio = COALESCE($9, periodo_inicio),
      periodo_fim = COALESCE($10, periodo_fim),
      veiculo = COALESCE($11, veiculo),
      plataforma = $12,
      formato = COALESCE($13, formato),
      posicionamento = COALESCE($14, posicionamento),
      url_destino = $15,
      impulsionado = COALESCE($16, impulsionado),
      segmentacao = $17,
      titulo = $18,
      tipos_compra = COALESCE($19, tipos_compra),
      campanha_veiculo_id = COALESCE($20, campanha_veiculo_id),
      cloudinary_public_id = COALESCE($21, cloudinary_public_id),
      cloudinary_url = COALESCE($22, cloudinary_url),
      tipo_midia = COALESCE($23, tipo_midia),
      link_postagem = $24,
      eh_performance = COALESCE($25, eh_performance),
      orcamento_projetado = $26,
      atualizado_em = now()
     WHERE id = $1
     RETURNING *`,
    [
      id, nome, adName?.trim() || null, campanha, campaignName, conjunto, descricao, observacoes,
      periodoInicio, periodoFim, veiculo,
      plataforma || null, formato || null, posicionamento || null, urlDestino || null,
      impulsionado !== undefined ? impulsionado : null,
      segmentacao || null, titulo || null,
      tiposCompra?.length ? tiposCompra : null,
      campanhaVeiculoId || null,
      midiaFields.publicId, midiaFields.secureUrl, midiaFields.tipoMidia,
      linkPostagem || null,
      ehPerformance !== undefined ? (ehPerformance === true || ehPerformance === "true") : null,
      (ehPerformance === true || ehPerformance === "true") ? (orcamentoProjetado || null) : null,
    ]
  );

  // So apaga a midia antiga do Cloudinary depois que a troca no banco foi confirmada.
  if (file && creativeAntigo?.cloudinary_public_id) {
    const cloudinary = getCloudinaryClient();
    await cloudinary.uploader.destroy(creativeAntigo.cloudinary_public_id, {
      resource_type: creativeAntigo.tipo_midia === "video" ? "video" : "image",
    });
  }

  const creative = rows[0] || null;
  if (creative && creativeAntigo) {
    // camposDepois so inclui chaves que de fato vieram no patch (undefined =
    // campo nao tocado nesta edicao, fica de fora do diff) -- registrarEdicaoCampos
    // ja filtra por "in camposDepois", entao basta montar o objeto com os
    // valores recebidos tal como chegaram na funcao.
    const camposAntes = {
      campanha: creativeAntigo.campanha, veiculo: creativeAntigo.veiculo, plataforma: creativeAntigo.plataforma,
      tiposCompra: creativeAntigo.tipos_compra, campaignName: creativeAntigo.campaign_name, conjunto: creativeAntigo.conjunto,
      formato: creativeAntigo.formato,
      periodoInicio: creativeAntigo.periodo_inicio ? new Date(creativeAntigo.periodo_inicio).toISOString().slice(0, 10) : null,
      periodoFim: creativeAntigo.periodo_fim ? new Date(creativeAntigo.periodo_fim).toISOString().slice(0, 10) : null,
      urlDestino: creativeAntigo.url_destino,
      impulsionado: creativeAntigo.impulsionado ? "Impulsionado" : "Dark Post", linkPostagem: creativeAntigo.link_postagem,
      segmentacao: creativeAntigo.segmentacao, titulo: creativeAntigo.titulo, posicionamento: creativeAntigo.posicionamento,
      descricao: creativeAntigo.descricao, observacoes: creativeAntigo.observacoes,
      ehPerformance: creativeAntigo.eh_performance ? "Sim" : "Não", orcamentoProjetado: creativeAntigo.orcamento_projetado,
    };
    const camposDepois = {};
    for (const [chave, valor] of Object.entries({
      campanha, veiculo, plataforma, tiposCompra, campaignName, conjunto, formato, periodoInicio, periodoFim,
      urlDestino, impulsionado: impulsionado !== undefined ? (impulsionado ? "Impulsionado" : "Dark Post") : undefined,
      linkPostagem, segmentacao, titulo, posicionamento, descricao, observacoes,
      ehPerformance: ehPerformance !== undefined ? ((ehPerformance === true || ehPerformance === "true") ? "Sim" : "Não") : undefined,
      orcamentoProjetado,
    })) {
      if (valor !== undefined) camposDepois[chave] = valor;
    }

    const campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
    await registrarEdicaoCampos({
      entidadeTipo: "criativo",
      entidadeId: creative.id,
      entidadeNome: creative.nome,
      campanhaId: campanhaIdLog,
      camposAntes,
      camposDepois,
      alteradoPor,
      labels: LABELS_CAMPOS_CREATIVE,
    });
  }

  return creative;
}

export async function deleteCreative(id, alteradoPor = null) {
  const creative = await getCreativeById(id);
  if (!creative) return false;

  // Resolve e grava o log ANTES do DELETE -- precisa do creative ainda existir
  // para achar a campanha dona dele (campanha_veiculo_id) e capturar o nome.
  const campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
  await registrarAcao({
    entidadeTipo: "criativo",
    entidadeId: creative.id,
    entidadeNome: creative.nome,
    campanhaId: campanhaIdLog,
    acao: "exclusao",
    alteradoPor,
  });

  // Criativos "Impulsionado" podem nao ter arquivo (so link_postagem) -- nesse
  // caso cloudinary_public_id fica null, entao nao ha nada a apagar no Cloudinary.
  if (creative.cloudinary_public_id) {
    const cloudinary = getCloudinaryClient();
    await cloudinary.uploader.destroy(creative.cloudinary_public_id, {
      resource_type: creative.tipo_midia === "video" ? "video" : "image",
    });
  }
  await query("DELETE FROM creatives WHERE id = $1", [id]);
  return true;
}

// Exclusao em massa (Matriz de Conteudo): remove varios criativos de uma vez,
// reaproveitando deleteCreative (mesma limpeza de midia no Cloudinary) para cada
// id. Ids invalidos sao pulados e reportados separadamente, sem interromper os
// demais -- mesmo padrao de updateCreativesBulk.
export async function deleteCreativesBulk(ids, alteradoPor = null) {
  const excluidos = [];
  const falharam = [];
  for (const id of ids) {
    try {
      const ok = await deleteCreative(id, alteradoPor);
      if (ok) excluidos.push(id);
      else falharam.push({ id, motivo: "Criativo não encontrado" });
    } catch (err) {
      falharam.push({ id, motivo: err.message || "Falha ao excluir" });
    }
  }
  return { excluidos, falharam };
}

export async function updateStatus(id, novoStatus, user) {
  const validStatuses = user.papel === "veiculo" ? STATUSES_VEICULO : STATUSES;
  if (!validStatuses.includes(novoStatus)) {
    const err = new Error("Status inválido para seu perfil");
    err.statusCode = 403;
    throw err;
  }

  const creative = await getCreativeById(id);
  if (!creative) return null;

  if (user.papel === "veiculo") {
    const temPosse = creative.campanha_veiculo_id
      ? vinculoIdsComAcessoMatriz(user).includes(creative.campanha_veiculo_id)
      : (scopeVeiculoFilter(user, null) || []).includes(creative.veiculo);
    if (!temPosse) {
      const err = new Error("Você não tem permissão para alterar este criativo");
      err.statusCode = 403;
      throw err;
    }
  }

  const { rows } = await query(
    `UPDATE creatives SET status = $2, atualizado_em = now() WHERE id = $1 RETURNING *`,
    [id, novoStatus]
  );

  await query(
    `INSERT INTO creative_status_history (creative_id, status_anterior, status_novo, alterado_por)
     VALUES ($1, $2, $3, $4)`,
    [id, creative.status, novoStatus, user.id]
  );

  const campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
  await registrarAcao({
    entidadeTipo: "criativo",
    entidadeId: creative.id,
    entidadeNome: creative.nome,
    campanhaId: campanhaIdLog,
    acao: "status",
    campo: "Status",
    valorAnterior: creative.status,
    valorNovo: novoStatus,
    alteradoPor: user.id,
  });

  return rows[0];
}

// Campos do formulario de criativo que podem ser aplicados em massa -- tudo exceto
// arquivo/nome/Ad Name, que sao unicos por criativo e nao fazem sentido repetir em
// varios de uma vez. Usado tanto para validar o patch recebido na rota (ignora
// qualquer chave fora desta lista) quanto para montar os argumentos de
// updateCreative.
export const CAMPOS_EDICAO_EM_MASSA = [
  "campanha", "campanhaVeiculoId", "veiculo", "plataforma", "tiposCompra",
  "campaignName", "conjunto", "formato", "periodoInicio", "periodoFim",
  "urlDestino", "impulsionado", "segmentacao", "titulo", "posicionamento",
  "descricao", "observacoes", "ehPerformance", "orcamentoProjetado",
];

// Edicao em massa (Matriz de Conteudo): aplica o mesmo patch (status e/ou outros
// campos do formulario) a varios criativos de uma vez. status usa updateStatus
// (que ja valida o status contra o papel do usuario, checa posse, e grava
// historico) -- os demais campos usam updateCreative diretamente, que ja e
// chamado exclusivamente a partir de rotas requireRole("agencia") no resto do
// sistema, entao a mesma garantia de escopo (agencia = sem restricao) se aplica
// aqui. Ids sem permissao ou invalidos sao pulados (fail-closed) e reportados
// separadamente do que foi de fato alterado, para a UI poder avisar sem
// interromper os demais.
export async function updateCreativesBulk(ids, patch, user) {
  const { status, ...camposRestantes } = patch || {};
  const patchValido = Object.fromEntries(
    Object.entries(camposRestantes).filter(([key]) => CAMPOS_EDICAO_EM_MASSA.includes(key))
  );
  const temCamposRestantes = Object.keys(patchValido).length > 0;

  const atualizados = [];
  const falharam = [];
  for (const id of ids) {
    try {
      let creative = null;
      if (status) creative = await updateStatus(id, status, user);
      if (temCamposRestantes) creative = await updateCreative(id, patchValido, user.id);
      if (creative) atualizados.push(creative);
      else falharam.push({ id, motivo: "Criativo não encontrado" });
    } catch (err) {
      falharam.push({ id, motivo: err.message || "Falha ao atualizar" });
    }
  }
  return { atualizados, falharam };
}

// Mesma gravacao de updateStatus, mas para o job de sincronizacao automatica
// (statusSyncService): sem checagem de permissao de papel (nao ha usuario na
// requisicao) e sem posse -- ja rodou sobre criativos elegiveis previamente
// filtrados. Registra o historico com origem 'automatico' e sem autor humano.
export async function updateStatusSistema(id, novoStatus) {
  const statusAnterior = await getCreativeById(id);
  if (!statusAnterior) return null;

  const { rows } = await query(
    `UPDATE creatives SET status = $2, atualizado_em = now() WHERE id = $1 RETURNING *`,
    [id, novoStatus]
  );

  await query(
    `INSERT INTO creative_status_history (creative_id, status_anterior, status_novo, alterado_por, origem)
     VALUES ($1, $2, $3, NULL, 'automatico')`,
    [id, statusAnterior.status, novoStatus]
  );

  const campanhaIdLog = await resolveCampanhaIdDoCreative(statusAnterior);
  await registrarAcao({
    entidadeTipo: "criativo",
    entidadeId: statusAnterior.id,
    entidadeNome: statusAnterior.nome,
    campanhaId: campanhaIdLog,
    acao: "status",
    campo: "Status",
    valorAnterior: statusAnterior.status,
    valorNovo: novoStatus,
    alteradoPor: null,
    origem: "automatico",
  });

  return rows[0];
}

export async function getStatusHistory(id) {
  const { rows } = await query(
    `SELECT h.*, u.nome AS alterado_por_nome
     FROM creative_status_history h
     JOIN users u ON u.id = h.alterado_por
     WHERE h.creative_id = $1
     ORDER BY h.alterado_em DESC`,
    [id]
  );
  return rows;
}
