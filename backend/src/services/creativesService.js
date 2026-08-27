import { query } from "../config/database.js";
import { getCloudinaryClient } from "../config/cloudinary.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { scopeVeiculoFilter, scopeCampanhaFilter } from "../utils/scopeFilter.js";
import { registrarAcao, registrarEdicaoCampos, resolveCampanhaIdDoCreative } from "./actionLogService.js";
import { registrarOperacaoBulk, COLUNA_POR_CAMPO } from "./bulkEditService.js";
import { removeAllCreativeFiles } from "./creativeFilesService.js";

// Import dinamico -- creativesSheetSyncService.js importa listCreativesByCampanha
// deste arquivo, entao um import estatico aqui criaria um ciclo. agendarSyncSheet
// e no-op instantaneo quando a campanha nao tem planilha vinculada, entao o
// custo do import() a cada chamada e desprezivel.
async function agendarSyncSheet(campanhaId) {
  const { agendarSyncSheet: fn } = await import("./creativesSheetSyncService.js");
  return fn(campanhaId);
}

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
  formularioNativo: "Formulário nativo",
  observacoesFormularioNativo: "Observações do formulário nativo",
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
         WHERE status != 'Rascunho' AND excluido_em IS NULL
           AND ((campanha_veiculo_id = ANY($1))
            OR (campanha_veiculo_id IS NULL AND veiculo = ANY($2) AND campanha = ANY($3)))
         ORDER BY criado_em DESC`,
        [vinculoIds, veiculos, campanhas]
      );
      return rows;
    }
    const { rows } = await query(
      `SELECT * FROM creatives
       WHERE status != 'Rascunho' AND excluido_em IS NULL
         AND ((campanha_veiculo_id = ANY($1))
          OR (campanha_veiculo_id IS NULL AND veiculo = ANY($2)))
       ORDER BY criado_em DESC`,
      [vinculoIds, veiculos]
    );
    return rows;
  }
  const { rows } = await query("SELECT * FROM creatives WHERE status != 'Rascunho' AND excluido_em IS NULL ORDER BY criado_em DESC");
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
         WHERE cr.status = 'Aguardando implementação' AND cr.excluido_em IS NULL
           AND ((cr.campanha_veiculo_id = ANY($1))
                OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2) AND cr.campanha = ANY($3)))
         ORDER BY cr.atualizado_em ASC`,
        [vinculoIds, veiculos, campanhas]
      );
      return rows;
    }
    const { rows } = await query(
      `${selectComCampanha}
       WHERE cr.status = 'Aguardando implementação' AND cr.excluido_em IS NULL
         AND ((cr.campanha_veiculo_id = ANY($1))
              OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2)))
       ORDER BY cr.atualizado_em ASC`,
      [vinculoIds, veiculos]
    );
    return rows;
  }

  const { rows } = await query(
    `${selectComCampanha}
     WHERE cr.status = 'Aguardando implementação' AND cr.excluido_em IS NULL
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
         WHERE cr.status = 'Com erro' AND cr.excluido_em IS NULL
           AND ((cr.campanha_veiculo_id = ANY($1))
                OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2) AND cr.campanha = ANY($3)))
         ORDER BY cr.atualizado_em DESC`,
        [vinculoIds, veiculos, campanhas]
      );
      return rows;
    }
    const { rows } = await query(
      `${selectComCampanha}
       WHERE cr.status = 'Com erro' AND cr.excluido_em IS NULL
         AND ((cr.campanha_veiculo_id = ANY($1))
              OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($2)))
       ORDER BY cr.atualizado_em DESC`,
      [vinculoIds, veiculos]
    );
    return rows;
  }

  const { rows } = await query(
    `${selectComCampanha}
     WHERE cr.status = 'Com erro' AND cr.excluido_em IS NULL
     ORDER BY cr.atualizado_em DESC`
  );
  return rows;
}

// Rascunhos do usuario logado -- escopado por autoria (criado_por), nao por
// permissao de veiculo/campanha como o resto da Matriz, ja que um rascunho e
// privado ao autor por definicao (pode nem ter campanha/veiculo preenchidos
// ainda). Nunca aparece em listCreatives/listCreativesByCampanha (ambos filtram
// implicitamente por nao ter status='Rascunho' na pratica, ja que esse status
// nunca e escolhivel via updateStatus -- STATUSES nao o inclui).
export async function listMeusRascunhos(userId) {
  const { rows } = await query(
    `SELECT * FROM creatives WHERE status = 'Rascunho' AND criado_por = $1 AND excluido_em IS NULL ORDER BY atualizado_em DESC`,
    [userId]
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
      `SELECT cr.*, cv.acesso_analise_criativo, cv.plataformas_analise_criativo,
              (SELECT COUNT(*) FROM creative_files cf WHERE cf.creative_id = cr.id) AS arquivos_extras
       FROM creatives cr
       LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
       WHERE cr.status != 'Rascunho' AND cr.excluido_em IS NULL
         AND ((cr.campanha_veiculo_id = ANY($1) AND cv.campanha_id = $2)
          OR (cr.campanha_veiculo_id IS NULL AND cr.veiculo = ANY($3)
              AND cr.campanha = (SELECT nome FROM campanhas WHERE id = $2)))
       ORDER BY cr.criado_em DESC`,
      [vinculoIds, campanhaId, veiculos]
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT cr.*, cv.acesso_analise_criativo, cv.plataformas_analise_criativo,
            (SELECT COUNT(*) FROM creative_files cf WHERE cf.creative_id = cr.id) AS arquivos_extras
     FROM creatives cr
     LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
     WHERE cr.status != 'Rascunho' AND cr.excluido_em IS NULL
       AND (cv.campanha_id = $1
        OR (cr.campanha_veiculo_id IS NULL AND cr.campanha = (SELECT nome FROM campanhas WHERE id = $1)))
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

  // formato agora e array (TEXT[]) -- casa se UPPER($6) estiver entre os
  // valores marcados no criativo, em vez de comparar igualdade direta.
  return matchUnico(
    `SELECT * FROM creatives WHERE ${adNameMatch} AND plataforma = $2 AND veiculo = $3 AND campanha = $4 AND $5 = ANY(tipos_compra) AND UPPER($6) = ANY(SELECT UPPER(f) FROM unnest(formato) AS f) AND excluido_em IS NULL`,
    [normalized, plataforma, vendedor, campanha, modeloCompra, formato]
  );
}

// Usado internamente por outras operacoes (restaurar, editar, exibir detalhe na
// lixeira) -- de proposito SEM filtro de excluido_em, ja que tambem precisa achar
// itens que estao na lixeira.
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
  status, formularioNativo, observacoesFormularioNativo, searchCampos,
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
       link_postagem, eh_performance, orcamento_projetado, status,
       formulario_nativo, observacoes_formulario_nativo, search_campos)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,COALESCE($27, 'Não registrado'),$28,$29,$30)
     RETURNING *`,
    [
      nome || null, adName?.trim() || null, campanha || null, campaignName || null, conjunto || null,
      descricao || null, observacoes || null, periodoInicio || null, periodoFim || null,
      veiculo || null, plataforma || null, formato?.length ? formato : [], posicionamento || null,
      urlDestino || null, impulsionado !== false, segmentacao || null, titulo || null,
      tiposCompra?.length ? tiposCompra : [],
      publicId, secureUrl, tipoMidia, criadoPor, campanhaVeiculoId || null,
      linkPostagem || null,
      ehPerformance === true || ehPerformance === "true",
      ehPerformance ? (orcamentoProjetado || null) : null,
      status || null,
      formularioNativo === true || formularioNativo === "true",
      observacoesFormularioNativo || null,
      searchCampos ? JSON.stringify(searchCampos) : null,
    ]
  );
  const creative = rows[0];

  // Rascunho nao entra no log de auditoria -- e um estado transitorio/privado
  // do autor, nao uma acao relevante pra agencia acompanhar (ainda nao existe
  // como criativo "de verdade" pros outros usuarios).
  if (creative.status !== "Rascunho") {
    const campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
    await registrarAcao({
      entidadeTipo: "criativo",
      entidadeId: creative.id,
      entidadeNome: creative.nome,
      campanhaId: campanhaIdLog,
      acao: "criacao",
      alteradoPor: criadoPor,
    });
    await agendarSyncSheet(campanhaIdLog);
  }

  return creative;
}

// pularRegistroOperacaoBulk: usado por updateCreativesBulk, que registra 1
// UNICA operacao desfazivel agrupando todos os criativos afetados, em vez de
// deixar cada chamada individual daqui dentro do loop criar sua propria
// operacao "de 1 criativo" (o que fragmentaria uma edicao em massa em N
// operacoes separadas no painel "Ultimas edições em massa").
export async function updateCreative(id, {
  file, cloudinaryUrl, cloudinaryPublicId, tipoMidia: tipoMidiaParam,
  nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
  periodoInicio, periodoFim, veiculo, plataforma, formato, posicionamento,
  urlDestino, impulsionado, segmentacao, titulo, tiposCompra, campanhaVeiculoId,
  linkPostagem, ehPerformance, orcamentoProjetado, publicarRascunho,
  formularioNativo, observacoesFormularioNativo, searchCampos,
}, alteradoPor = null, pularRegistroOperacaoBulk = false) {
  // Sempre busca o estado anterior (nao so quando ha arquivo novo) -- usado
  // tanto para a limpeza de midia antiga quanto para o diff do log de auditoria.
  const creativeAntigo = await getCreativeById(id);

  // Valida contra o periodo EFETIVO final (patch recebido + o que ja estava
  // salvo, ja que a query usa COALESCE) -- evita permitir uma edicao parcial
  // que so muda um dos dois lados e deixa inicio > fim sem ninguem notar.
  const inicioEfetivo = periodoInicio || creativeAntigo?.periodo_inicio?.toISOString?.().slice(0, 10) || creativeAntigo?.periodo_inicio;
  const fimEfetivo = periodoFim || creativeAntigo?.periodo_fim?.toISOString?.().slice(0, 10) || creativeAntigo?.periodo_fim;
  if (inicioEfetivo && fimEfetivo && String(inicioEfetivo).slice(0, 10) > String(fimEfetivo).slice(0, 10)) {
    const err = new Error("A data inicial não pode ser depois da data final");
    err.statusCode = 400;
    throw err;
  }

  // cloudinaryUrl/cloudinaryPublicId: arquivo ja enviado direto do navegador
  // pro Cloudinary (ver gerarAssinaturaUpload) -- usado pra videos grandes,
  // que dariam erro 413 se subissem pelo backend na Vercel. file continua
  // valendo pra imagens/videos pequenos, enviados via multipart normal.
  let midiaFields = { publicId: null, secureUrl: null, tipoMidia: null };
  if (file) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_CREATIVES_FOLDER);
    midiaFields = {
      publicId: upload.public_id,
      secureUrl: upload.secure_url,
      tipoMidia: upload.resource_type === "video" ? "video" : "image",
    };
  } else if (cloudinaryUrl) {
    midiaFields = {
      publicId: cloudinaryPublicId,
      secureUrl: cloudinaryUrl,
      tipoMidia: tipoMidiaParam || "image",
    };
  }

  // Campos de texto livre (ad_name, campaign_name, conjunto/Ad Group, descricao,
  // observacoes) apagam de verdade quando o usuario deixa em branco, mas
  // continuam intactos quando o campo simplesmente nao veio na edicao (ex:
  // edicao em massa que nao marcou "Aplicar" naquele campo). Nao da pra
  // resolver isso so com COALESCE(valor, campo) -- precisa de uma flag por
  // campo dizendo se ele foi tocado ($xTocado), porque uma vez que o campo e
  // tocado, string vazia (null) e um valor valido a gravar (apagar), nao um
  // "use o antigo". Antes todos esses campos usavam COALESCE puro e nunca
  // conseguiam ser limpos por edicao, so cresciam.
  const adNameTocado = adName !== undefined;
  const campaignNameTocado = campaignName !== undefined;
  const conjuntoTocado = conjunto !== undefined;
  const descricaoTocado = descricao !== undefined;
  const observacoesTocado = observacoes !== undefined;
  const observacoesFormularioNativoTocado = observacoesFormularioNativo !== undefined;
  const searchCamposTocado = searchCampos !== undefined;

  const { rows } = await query(
    `UPDATE creatives SET
      nome = COALESCE($2, nome),
      ad_name = CASE WHEN $28 THEN $3 ELSE ad_name END,
      campanha = COALESCE($4, campanha),
      campaign_name = CASE WHEN $29 THEN $5 ELSE campaign_name END,
      conjunto = CASE WHEN $30 THEN $6 ELSE conjunto END,
      descricao = CASE WHEN $31 THEN $7 ELSE descricao END,
      observacoes = CASE WHEN $32 THEN $8 ELSE observacoes END,
      periodo_inicio = COALESCE($9, periodo_inicio),
      periodo_fim = COALESCE($10, periodo_fim),
      veiculo = COALESCE($11, veiculo),
      plataforma = COALESCE($12, plataforma),
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
      orcamento_projetado = CASE WHEN $25 IS NULL THEN orcamento_projetado ELSE $26 END,
      status = CASE WHEN status = 'Rascunho' AND $27 = true THEN 'Não registrado' ELSE status END,
      formulario_nativo = COALESCE($33, formulario_nativo),
      observacoes_formulario_nativo = CASE WHEN $34 THEN $35 ELSE observacoes_formulario_nativo END,
      search_campos = CASE WHEN $36 THEN $37 ELSE search_campos END,
      atualizado_em = now()
     WHERE id = $1
     RETURNING *`,
    [
      id, nome, adNameTocado ? (adName.trim() || null) : null, campanha,
      campaignNameTocado ? (campaignName.trim() || null) : null,
      conjuntoTocado ? (conjunto.trim() || null) : null,
      descricaoTocado ? (descricao.trim() || null) : null,
      observacoesTocado ? (observacoes.trim() || null) : null,
      periodoInicio, periodoFim, veiculo,
      plataforma || null, formato?.length ? formato : null, posicionamento || null, urlDestino || null,
      impulsionado !== undefined ? impulsionado : null,
      segmentacao || null, titulo || null,
      tiposCompra?.length ? tiposCompra : null,
      campanhaVeiculoId || null,
      midiaFields.publicId, midiaFields.secureUrl, midiaFields.tipoMidia,
      linkPostagem || null,
      ehPerformance !== undefined ? (ehPerformance === true || ehPerformance === "true") : null,
      (ehPerformance === true || ehPerformance === "true") ? (orcamentoProjetado || null) : null,
      publicarRascunho === true || publicarRascunho === "true",
      adNameTocado, campaignNameTocado, conjuntoTocado, descricaoTocado, observacoesTocado,
      formularioNativo !== undefined ? (formularioNativo === true || formularioNativo === "true") : null,
      observacoesFormularioNativoTocado, observacoesFormularioNativoTocado ? (observacoesFormularioNativo.trim() || null) : null,
      searchCamposTocado, searchCamposTocado ? (searchCampos ? JSON.stringify(searchCampos) : null) : null,
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
      formularioNativo: creativeAntigo.formulario_nativo ? "Nativo da plataforma" : "Site/LP externa",
      observacoesFormularioNativo: creativeAntigo.observacoes_formulario_nativo,
    };
    const camposDepois = {};
    for (const [chave, valor] of Object.entries({
      campanha, veiculo, plataforma, tiposCompra, campaignName, conjunto, formato, periodoInicio, periodoFim,
      urlDestino, impulsionado: impulsionado !== undefined ? (impulsionado ? "Impulsionado" : "Dark Post") : undefined,
      linkPostagem, segmentacao, titulo, posicionamento, descricao, observacoes,
      ehPerformance: ehPerformance !== undefined ? ((ehPerformance === true || ehPerformance === "true") ? "Sim" : "Não") : undefined,
      orcamentoProjetado,
      formularioNativo: formularioNativo !== undefined ? ((formularioNativo === true || formularioNativo === "true") ? "Nativo da plataforma" : "Site/LP externa") : undefined,
      observacoesFormularioNativo,
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

    // Registra tambem uma operacao desfazivel (mesma janela de 2h do "Editar
    // em massa") para a edicao individual -- so quando algum campo mapeado em
    // COLUNA_POR_CAMPO de fato foi tocado (chaves de camposDepois, que ja
    // representa exatamente o que veio no patch). O snapshot guarda os
    // valores BRUTOS de creativeAntigo (colunas reais, nao o texto formatado
    // usado no diff de auditoria acima), pra poder restaurar de verdade.
    const camposComColuna = Object.keys(camposDepois).filter((k) => COLUNA_POR_CAMPO[k]);
    if (!pularRegistroOperacaoBulk && camposComColuna.length > 0 && alteradoPor) {
      const valoresAntes = {};
      for (const chave of camposComColuna) valoresAntes[chave] = creativeAntigo[COLUNA_POR_CAMPO[chave]];
      await registrarOperacaoBulk(alteradoPor, camposComColuna, [{ creativeId: creative.id, valoresAntes }]);
    }

    await agendarSyncSheet(campanhaIdLog);
  }

  return creative;
}

// Manda o criativo pra lixeira (soft-delete) -- NAO apaga do Cloudinary aqui,
// isso so acontece na exclusao definitiva (excluirCreativeDefinitivo), para o
// arquivo continuar disponivel caso o item seja restaurado.
export async function deleteCreative(id, alteradoPor = null) {
  const creative = await getCreativeById(id);
  if (!creative || creative.excluido_em) return false;

  // Resolve e grava o log ANTES do UPDATE -- precisa do creative ainda "ativo"
  // para achar a campanha dona dele (campanha_veiculo_id) e capturar o nome.
  // Rascunho descartado nao entra no log, mesmo motivo da criacao (nunca foi
  // uma acao visivel pra agencia acompanhar).
  let campanhaIdLog = null;
  if (creative.status !== "Rascunho") {
    campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
    await registrarAcao({
      entidadeTipo: "criativo",
      entidadeId: creative.id,
      entidadeNome: creative.nome,
      campanhaId: campanhaIdLog,
      acao: "exclusao",
      alteradoPor,
    });
  }

  await query(
    "UPDATE creatives SET excluido_em = now(), excluido_por = $2 WHERE id = $1",
    [id, alteradoPor]
  );

  // Sincroniza DEPOIS do UPDATE -- listCreativesByCampanha (usado dentro da
  // sincronizacao) filtra excluido_em IS NULL, entao rodar antes do UPDATE
  // ainda veria o criativo como ativo e manteria a linha na planilha.
  if (campanhaIdLog) await agendarSyncSheet(campanhaIdLog);

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

// Lista os criativos na lixeira, com nome de quem excluiu para exibicao.
// campanha_id_ref resolvido igual ao resto do sistema (campanha_veiculo_id ->
// campanha_veiculos.campanha_id, com fallback pelo texto solto creatives.campanha
// em criativos legados) -- necessario pro modal de detalhe completo (com aba de
// Performance) na Lixeira, que precisa de campanhaId pra buscar dado por Ad Name.
export async function listLixeiraCreatives() {
  const { rows } = await query(
    `SELECT cr.*, u.nome AS excluido_por_nome,
            COALESCE(c.id, (SELECT id FROM campanhas WHERE nome = cr.campanha)) AS campanha_id_ref
     FROM creatives cr
     LEFT JOIN users u ON u.id = cr.excluido_por
     LEFT JOIN campanha_veiculos cv ON cv.id = cr.campanha_veiculo_id
     LEFT JOIN campanhas c ON c.id = cv.campanha_id
     WHERE cr.excluido_em IS NOT NULL
     ORDER BY cr.excluido_em DESC`
  );
  return rows;
}

export async function restaurarCreative(id, alteradoPor = null) {
  const { rows } = await query(
    `UPDATE creatives SET excluido_em = NULL, excluido_por = NULL WHERE id = $1 RETURNING *`,
    [id]
  );
  const restaurado = rows[0];
  if (restaurado && restaurado.status !== "Rascunho") {
    const campanhaIdLog = await resolveCampanhaIdDoCreative(restaurado);
    await registrarAcao({
      entidadeTipo: "criativo",
      entidadeId: restaurado.id,
      entidadeNome: restaurado.nome,
      campanhaId: campanhaIdLog,
      acao: "restauracao",
      alteradoPor,
    });
    await agendarSyncSheet(campanhaIdLog);
  }
  return restaurado || null;
}

// Exclusao definitiva (esvaziar lixeira): so aqui a midia e de fato apagada do
// Cloudinary e a linha e removida do banco -- ate este momento o item continuava
// recuperavel via restaurarCreative.
export async function excluirCreativeDefinitivo(id, alteradoPor = null) {
  const creative = await getCreativeById(id);
  if (!creative) return false;

  if (creative.cloudinary_public_id) {
    const cloudinary = getCloudinaryClient();
    await cloudinary.uploader.destroy(creative.cloudinary_public_id, {
      resource_type: creative.tipo_midia === "video" ? "video" : "image",
    });
  }
  await removeAllCreativeFiles(id);

  await query("DELETE FROM creatives WHERE id = $1", [id]);

  if (creative.status !== "Rascunho") {
    const campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
    await registrarAcao({
      entidadeTipo: "criativo",
      entidadeId: creative.id,
      entidadeNome: creative.nome,
      campanhaId: campanhaIdLog,
      acao: "exclusao_definitiva",
      alteradoPor,
    });
    await agendarSyncSheet(campanhaIdLog);
  }

  return true;
}

export async function updateStatus(id, novoStatus, user, pularRegistroOperacaoBulk = false) {
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

  // Mudanca de status tambem entra no Desfazer (2h), mesmo padrao dos demais
  // campos -- cobre o caso de perceber o erro so depois de fechar a tela
  // (na hora, o status ja e trivialmente reversivel clicando de novo no card).
  if (!pularRegistroOperacaoBulk) {
    await registrarOperacaoBulk(user.id, ["status"], [{ creativeId: creative.id, valoresAntes: { status: creative.status } }]);
    await agendarSyncSheet(campanhaIdLog);
  }

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
  "formularioNativo", "observacoesFormularioNativo",
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

  // Campos do patch que de fato tem uma coluna mapeada (ver COLUNA_POR_CAMPO
  // em bulkEditService.js), incluindo "status" quando presente -- e o que
  // vira "campos_alterados" na operacao e o que e capturado no snapshot de
  // cada criativo, para poder desfazer depois (agrupado numa unica operacao,
  // nao uma por criativo -- updateStatus/updateCreative pulam seu proprio
  // registro individual aqui dentro do loop, ver pularRegistroOperacaoBulk).
  const camposComColuna = Object.keys(patchValido).filter((k) => COLUNA_POR_CAMPO[k]);
  if (status) camposComColuna.push("status");
  const snapshots = [];

  const atualizados = [];
  const falharam = [];
  for (const id of ids) {
    try {
      let valoresAntes = null;
      if (camposComColuna.length > 0) {
        const antes = await getCreativeById(id);
        if (antes) {
          valoresAntes = {};
          for (const chave of camposComColuna) valoresAntes[chave] = antes[COLUNA_POR_CAMPO[chave]];
        }
      }
      let creative = null;
      if (status) creative = await updateStatus(id, status, user, true);
      if (temCamposRestantes) creative = await updateCreative(id, patchValido, user.id, true);
      if (creative) {
        atualizados.push(creative);
        if (valoresAntes) snapshots.push({ creativeId: id, valoresAntes });
      } else {
        falharam.push({ id, motivo: "Criativo não encontrado" });
      }
    } catch (err) {
      falharam.push({ id, motivo: err.message || "Falha ao atualizar" });
    }
  }

  let operationId = null;
  if (snapshots.length > 0) {
    operationId = await registrarOperacaoBulk(user.id, camposComColuna, snapshots);
  }

  // Sincroniza 1x por campanha distinta afetada, nao por item do loop
  // (updateStatus/updateCreative acima pulam seu proprio sync individual via
  // pularRegistroOperacaoBulk=true, exatamente pra isso).
  const campanhaIdsAfetados = new Set();
  for (const creative of atualizados) {
    const campanhaIdLog = await resolveCampanhaIdDoCreative(creative);
    if (campanhaIdLog) campanhaIdsAfetados.add(campanhaIdLog);
  }
  for (const campanhaIdLog of campanhaIdsAfetados) {
    await agendarSyncSheet(campanhaIdLog);
  }

  return { atualizados, falharam, operationId };
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
