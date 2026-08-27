import { Router } from "express";
import multer from "multer";
import { requireRole } from "../middleware/auth.js";
import {
  listCreatives,
  listCreativesByCampanha,
  listCreativesAImplementar,
  listCreativesComErro,
  listMeusRascunhos,
  getCreativeById,
  createCreative,
  updateCreative,
  deleteCreative,
  deleteCreativesBulk,
  updateStatus,
  updateCreativesBulk,
  getStatusHistory,
  STATUSES,
  STATUSES_VEICULO,
} from "../services/creativesService.js";
import {
  listMencionaveisPorCreative, listComentariosPorCreative, criarComentario,
  editarComentario, excluirComentario, alternarReacao,
} from "../services/commentsService.js";
import { listarOperacoesBulk, desfazerOperacaoBulk, desfazerItemBulk } from "../services/bulkEditService.js";
import { gerarExportacaoMatriz, listPlataformasDaCampanha } from "../services/creativesExportService.js";
import { listFilesByCreative, addCreativeFiles, addCreativeFilesJaEnviados, removeCreativeFile, gerarZipDoCreative, definirCapa, reordenarCreativeFiles } from "../services/creativeFilesService.js";
import {
  getCampanhaSheetSyncConfig, upsertCampanhaSheetSync, getSheetSyncSelecao,
  setSheetSyncSelecao, sincronizarCampanha,
} from "../services/creativesSheetSyncService.js";
import { getExportConfig, setExportConfig } from "../services/creativesColumnsConfigService.js";
import { COLUNAS_BASE, COLUNAS_GOOGLE } from "../services/creativesExportService.js";
import { gerarAssinaturaUpload } from "../utils/cloudinaryUpload.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^(image|video)\//.test(file.mimetype)) {
      return cb(new Error("Arquivo deve ser imagem ou vídeo"));
    }
    cb(null, true);
  },
});

function handleUploadErrors(req, res, next) {
  return (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Arquivo muito grande. O limite é de 100MB." });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  };
}

// Retorna lista de status válidos para o papel do usuário logado
router.get("/statuses", (req, res) => {
  res.json(req.user.papel === "veiculo" ? STATUSES_VEICULO : STATUSES);
});

// Assinatura pra upload DIRETO do navegador pro Cloudinary (ver
// gerarAssinaturaUpload) -- usada pra arquivos grandes (video), que o
// upload via backend (POST multipart) nao suporta na Vercel por causa do
// limite de tamanho de corpo de requisicao (erro 413 acima de ~4.5MB).
router.get("/upload-signature", requireRole("agencia"), (req, res) => {
  res.json(gerarAssinaturaUpload(process.env.CLOUDINARY_CREATIVES_FOLDER));
});

// Sem campanhaId: lista legada (usada so em locais que ainda nao migraram para a
// Matriz por campanha). Com campanhaId: filtra so os criativos daquela campanha --
// e o caminho usado pela nova Matriz, essencial com milhares de campanhas.
router.get("/", async (req, res, next) => {
  try {
    const { campanhaId } = req.query;
    const creatives = campanhaId
      ? await listCreativesByCampanha(req.user, campanhaId)
      : await listCreatives(req.user);
    res.json(creatives);
  } catch (err) {
    next(err);
  }
});

// Tela global "A implementar": criativos com status "Aguardando implementação" de
// TODAS as campanhas do usuario. Precisa vir antes de "/:id/history" -- senao Express
// trataria "a-implementar" como um :id. So agencia/veiculo tem uso previsto para isso.
router.get("/a-implementar", requireRole("agencia", "veiculo"), async (req, res, next) => {
  try {
    res.json(await listCreativesAImplementar(req.user));
  } catch (err) {
    next(err);
  }
});

// Alertas para o sino de notificacoes: criativos com status "Com erro" (atribuido
// so manualmente, sem gatilho automatico) de todas as campanhas do usuario. Mesmo
// motivo de ordem de rota que "a-implementar" acima.
router.get("/alertas", requireRole("agencia", "veiculo"), async (req, res, next) => {
  try {
    res.json(await listCreativesComErro(req.user));
  } catch (err) {
    next(err);
  }
});

// Rascunhos do usuario logado -- privados, escopados por autoria. Mesmo motivo
// de ordem de rota que "a-implementar"/"alertas" acima.
router.get("/meus-rascunhos", requireRole("agencia"), async (req, res, next) => {
  try {
    res.json(await listMeusRascunhos(req.user.id));
  } catch (err) {
    next(err);
  }
});

// Salva um rascunho: mesma criacao de sempre, mas sem nenhuma validacao de
// campos obrigatorios (o usuario pode ter fechado o formulario no meio do
// preenchimento) e sempre com status='Rascunho', independente do que o
// cliente mandar. Precisa vir antes de "/:id/..." pelo mesmo motivo das rotas
// acima.
router.post(
  "/rascunho",
  requireRole("agencia"),
  (req, res, next) => upload.single("file")(req, res, handleUploadErrors(req, res, next)),
  async (req, res, next) => {
    try {
      const {
        nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
        periodoInicio, periodoFim, veiculo, plataforma, formato, posicionamento,
        urlDestino, impulsionado, segmentacao, titulo, tiposCompra,
        cloudinaryUrl, cloudinaryPublicId, tipoMidia, campanhaVeiculoId, linkPostagem,
      } = req.body;
      const creative = await createCreative({
        file: req.file,
        cloudinaryUrl, cloudinaryPublicId, tipoMidia,
        nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
        periodoInicio, periodoFim, veiculo, plataforma, formato, posicionamento,
        urlDestino,
        impulsionado: impulsionado !== "false",
        segmentacao, titulo,
        tiposCompra: tiposCompra ? JSON.parse(tiposCompra) : [],
        criadoPor: req.user.id,
        campanhaVeiculoId: campanhaVeiculoId || null,
        linkPostagem,
        status: "Rascunho",
      });
      res.status(201).json(creative);
    } catch (err) {
      next(err);
    }
  }
);

// Edicao em massa (Matriz de Conteudo): aplica o mesmo patch (status e/ou outros
// campos do formulario, ver CAMPOS_EDICAO_EM_MASSA) a varios criativos de uma vez.
// Mesmo motivo de ordem de rota que "a-implementar"/"alertas" acima -- precisa vir
// antes de "/:id/..." senao Express trataria "bulk" como um :id.
router.patch("/bulk", requireRole("agencia"), async (req, res, next) => {
  try {
    const { ids, patch } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Informe ao menos um id de criativo" });
    }
    if (!patch || Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Informe ao menos um campo para alterar" });
    }
    const resultado = await updateCreativesBulk(ids, patch, req.user);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// Ultimas edicoes em massa do usuario logado, ainda dentro da janela de 2h e
// nao desfeitas -- so essas aparecem no painel "Ultimas edições" da Matriz.
// Mesmo motivo de ordem de rota das outras acima ("bulk-operations" antes de "/:id").
router.get("/bulk-operations", requireRole("agencia", "veiculo"), async (req, res, next) => {
  try {
    const operacoes = await listarOperacoesBulk(req.user.id);
    res.json(operacoes);
  } catch (err) {
    next(err);
  }
});

router.post("/bulk-operations/:id/undo", requireRole("agencia", "veiculo"), async (req, res, next) => {
  try {
    const resultado = await desfazerOperacaoBulk(req.params.id, req.user.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// Desfaz so 1 criativo dentro de uma edicao em massa, sem reverter os demais.
router.post("/bulk-operations/items/:snapshotId/undo", requireRole("agencia", "veiculo"), async (req, res, next) => {
  try {
    const resultado = await desfazerItemBulk(req.params.snapshotId, req.user.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// Plataformas disponiveis pra exportar, usado pra popular o menu de selecao
// antes de baixar o Excel. Mesmo motivo de ordem de rota das outras acima.
router.get("/export/:campanhaId/plataformas", async (req, res, next) => {
  try {
    res.json(await listPlataformasDaCampanha(req.user, req.params.campanhaId));
  } catch (err) {
    next(err);
  }
});

// Exporta os criativos de uma campanha em Excel, uma aba por plataforma/canal
// -- mesmo escopo de visibilidade de listCreativesByCampanha (respeitando
// papel/vinculos do usuario). "plataformas" (query, repetida) filtra so os
// canais escolhidos -- sem o parametro, exporta todos. Sempre xlsx puro --
// criativos com multiplos arquivos tem seu proprio link de zip na coluna
// "Link da peça" (ver GET /:id/files/zip), a exportacao da campanha nao
// empacota tudo junto. Precisa vir antes de "/:id/..." pelo mesmo motivo das
// outras rotas especificas acima.
router.get("/export/:campanhaId", async (req, res, next) => {
  try {
    const plataformas = req.query.plataformas
      ? (Array.isArray(req.query.plataformas) ? req.query.plataformas : [req.query.plataformas])
      : null;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const { buffer } = await gerarExportacaoMatriz(req.user, req.params.campanhaId, plataformas, baseUrl);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="matriz-de-conteudo-${req.params.campanhaId}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// Estado atual do "Gerar planilha" pra uma campanha: config da planilha
// vinculada (se houver) + quais creative_id estao marcados hoje -- usado pra
// pre-marcar os checkboxes quando o modal reabre. Precisa vir antes de
// "/:id/..." pelo mesmo motivo das outras rotas especificas acima.
router.get("/sheet-sync/:campanhaId", requireRole("agencia"), async (req, res, next) => {
  try {
    const [config, selecionados] = await Promise.all([
      getCampanhaSheetSyncConfig(req.params.campanhaId),
      getSheetSyncSelecao(req.params.campanhaId),
    ]);
    res.json({
      spreadsheetId: config?.spreadsheet_id || null,
      ultimaSincronizacaoEm: config?.ultima_sincronizacao_em || null,
      ultimoErro: config?.ultimo_erro || null,
      selecionados,
    });
  } catch (err) {
    next(err);
  }
});

// Salva a selecao marcada no modal "Gerar planilha" e sincroniza na hora --
// desmarcar um criativo que ja estava la remove a linha dele na mesma
// chamada. Se spreadsheetId vier vazio, so atualiza a selecao (sem planilha
// vinculada ainda nada e escrito -- fica pronto pra quando o usuario colar o link).
router.put("/sheet-sync/:campanhaId", requireRole("agencia"), async (req, res, next) => {
  try {
    const { spreadsheetId, creativeIds } = req.body;
    if (spreadsheetId) {
      await upsertCampanhaSheetSync(req.params.campanhaId, spreadsheetId);
    }
    const selecionados = await setSheetSyncSelecao(req.params.campanhaId, creativeIds);
    const config = await getCampanhaSheetSyncConfig(req.params.campanhaId);
    if (config?.spreadsheet_id) {
      await sincronizarCampanha(req.params.campanhaId);
    }
    const configAtualizada = await getCampanhaSheetSyncConfig(req.params.campanhaId);
    res.json({
      spreadsheetId: configAtualizada?.spreadsheet_id || null,
      ultimaSincronizacaoEm: configAtualizada?.ultima_sincronizacao_em || null,
      ultimoErro: configAtualizada?.ultimo_erro || null,
      selecionados,
    });
  } catch (err) {
    next(err);
  }
});

// Colunas disponiveis (base + so-Google) e a config atual de colunas por
// plataforma/criativo da campanha -- popula a secao "Colunas" do modal
// "Gerar planilha". Precisa vir antes de "/:id/..." pelo mesmo motivo das
// outras rotas especificas acima.
router.get("/export-config/:campanhaId", requireRole("agencia"), async (req, res, next) => {
  try {
    const config = await getExportConfig(req.params.campanhaId);
    res.json({
      colunasBase: COLUNAS_BASE.map(({ key, header }) => ({ key, header })),
      colunasGoogle: COLUNAS_GOOGLE.map(({ key, header }) => ({ key, header })),
      config,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/export-config/:campanhaId", requireRole("agencia"), async (req, res, next) => {
  try {
    const config = await setExportConfig(req.params.campanhaId, req.body.config || {});
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    res.json(await getStatusHistory(req.params.id));
  } catch (err) {
    next(err);
  }
});

// Arquivos adicionais de um criativo (ex: varios tamanhos de banner do mesmo
// anuncio Display) -- separado do arquivo principal (upload de sempre).
router.get("/:id/files", async (req, res, next) => {
  try {
    res.json(await listFilesByCreative(req.params.id));
  } catch (err) {
    next(err);
  }
});

// Baixa TODOS os arquivos do criativo (principal + extras) -- usado pelo
// botao "Baixar" do card quando ha mais de 1 arquivo (senao o link direto
// pro cloudinary_url, ja usado hoje, so trazia o arquivo principal).
router.get("/:id/files/zip", async (req, res, next) => {
  try {
    const creative = await getCreativeById(req.params.id);
    if (!creative) return res.status(404).json({ error: "Criativo não encontrado" });
    const buffer = await gerarZipDoCreative(creative);
    const nomeBase = (creative.titulo || creative.nome || `criativo-${creative.id}`).replace(/[\\/:*?"<>|]/g, "-");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeBase}.zip"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/files",
  requireRole("agencia"),
  (req, res, next) => upload.array("files", 20)(req, res, handleUploadErrors(req, res, next)),
  async (req, res, next) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ error: "Envie ao menos um arquivo" });
      }
      res.status(201).json(await addCreativeFiles(req.params.id, req.files));
    } catch (err) {
      next(err);
    }
  }
);

// Registra arquivos ja enviados direto do navegador pro Cloudinary (ver
// uploadDireto no client.js) -- so grava a URL, sem reenviar o arquivo.
// Usado pra videos grandes, que dariam erro 413 se subissem via multipart.
router.post("/:id/files/ja-enviados", requireRole("agencia"), async (req, res, next) => {
  try {
    const { arquivos } = req.body;
    if (!Array.isArray(arquivos) || !arquivos.length) {
      return res.status(400).json({ error: "Envie ao menos um arquivo" });
    }
    res.status(201).json(await addCreativeFilesJaEnviados(req.params.id, arquivos));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/files/:fileId", requireRole("agencia"), async (req, res, next) => {
  try {
    const removido = await removeCreativeFile(req.params.fileId);
    if (!removido) return res.status(404).json({ error: "Arquivo não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Reordena os arquivos ADICIONAIS via drag-and-drop no formulario de edicao
// -- fileIds e a lista completa (todos os ids de creative_files do criativo)
// na nova ordem. Essa ordem vale pro carrossel e pra numeracao do zip.
router.put("/:id/files/ordem", requireRole("agencia"), async (req, res, next) => {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds)) return res.status(400).json({ error: "fileIds deve ser uma lista" });
    res.json(await reordenarCreativeFiles(req.params.id, fileIds));
  } catch (err) {
    next(err);
  }
});

// Troca qual arquivo e a capa/preview do criativo (promove um extra pra
// principal, o principal atual desce pra extra).
router.patch("/:id/files/:fileId/capa", requireRole("agencia"), async (req, res, next) => {
  try {
    const creative = await getCreativeById(req.params.id);
    if (!creative) return res.status(404).json({ error: "Criativo não encontrado" });
    const atualizado = await definirCapa(creative, req.params.fileId);
    if (!atualizado) return res.status(404).json({ error: "Arquivo não encontrado" });
    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

// Comentarios com @mencao -- qualquer usuario autenticado pode ver/comentar
// (o escopo real de "quem tem acesso a este criativo" ja foi aplicado antes,
// na listagem que trouxe o creativo pra tela; aqui so validamos identidade).
router.get("/:id/comments/mentionable", async (req, res, next) => {
  try {
    res.json(await listMencionaveisPorCreative(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/comments", async (req, res, next) => {
  try {
    res.json(await listComentariosPorCreative(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/comments", async (req, res, next) => {
  try {
    const { texto, mencionadosIds, parentId } = req.body;
    if (!texto?.trim()) return res.status(400).json({ error: "Escreva algo para comentar" });
    const comentario = await criarComentario({
      creativeId: req.params.id,
      autorId: req.user.id,
      texto: texto.trim(),
      mencionadosIds: Array.isArray(mencionadosIds) ? mencionadosIds : [],
      parentId: parentId || null,
    });
    res.status(201).json(comentario);
  } catch (err) {
    next(err);
  }
});

router.post("/comments/:commentId/reactions", async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji?.trim()) return res.status(400).json({ error: "Informe um emoji" });
    const reacoes = await alternarReacao(req.params.commentId, req.user.id, emoji.trim());
    res.json(reacoes);
  } catch (err) {
    next(err);
  }
});

router.put("/comments/:commentId", async (req, res, next) => {
  try {
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ error: "Escreva algo para comentar" });
    const comentario = await editarComentario(req.params.commentId, req.user.id, texto.trim());
    if (!comentario) return res.status(404).json({ error: "Comentário não encontrado" });
    res.json(comentario);
  } catch (err) {
    next(err);
  }
});

router.delete("/comments/:commentId", async (req, res, next) => {
  try {
    const excluido = await excluirComentario(req.params.commentId, req.user.id);
    if (!excluido) return res.status(404).json({ error: "Comentário não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireRole("agencia"),
  (req, res, next) => upload.single("file")(req, res, handleUploadErrors(req, res, next)),
  async (req, res, next) => {
    try {
      const {
        nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
        periodoInicio, periodoFim, veiculo, plataforma, formato, posicionamento,
        urlDestino, impulsionado, segmentacao, titulo, tiposCompra,
        cloudinaryUrl, cloudinaryPublicId, tipoMidia, campanhaVeiculoId, linkPostagem,
        formularioNativo, observacoesFormularioNativo, searchCampos,
      } = req.body;
      const ehImpulsionado = impulsionado !== "false";
      const tiposCompraParsed = tiposCompra ? JSON.parse(tiposCompra) : [];
      // formato agora e multi-selecao (ex: Performance Max = Search + Display
      // juntos) -- chega como JSON string do FormData, igual tiposCompra.
      const formatoParsed = formato ? JSON.parse(formato) : [];
      // Google Search (formato inclui "Search") nao tem peca visual -- nenhum
      // dos campos de texto do Search e obrigatorio. Em PMax (Search + outro
      // formato junto), o upload de arquivo continua disponivel/obrigatorio
      // pelos OUTROS formatos marcados -- so isenta quando Search e o UNICO
      // formato selecionado.
      const ehSoSearch = formatoParsed.length === 1 && formatoParsed[0] === "Search";
      // "Impulsionado" parte de um post ja publicado organicamente -- exige o link
      // da postagem em vez de arquivo. "Dark Post" nao existe como post organico,
      // entao continua exigindo arquivo. Nenhuma das duas se aplica quando o
      // criativo e so Search.
      if (!ehSoSearch && ehImpulsionado && !linkPostagem?.trim()) {
        return res.status(400).json({ error: "Informe o link da postagem impulsionada" });
      }
      if (!ehSoSearch && !ehImpulsionado && !req.file && !cloudinaryUrl) {
        return res.status(400).json({ error: "Arquivo obrigatório para Dark Post" });
      }
      if (!nome || !campanha || !veiculo) {
        return res.status(400).json({ error: "Campos obrigatórios: nome, campanha, veiculo" });
      }
      if (!formatoParsed.length) {
        return res.status(400).json({ error: "Selecione o formato" });
      }
      if (periodoInicio && periodoFim && periodoInicio > periodoFim) {
        return res.status(400).json({ error: "A data inicial não pode ser depois da data final" });
      }
      // CPL com formulario nativo da propria plataforma exige a descricao desse
      // formulario (nao ha URL/LP externa pra documentar o que foi configurado).
      const ehCPLNativo = tiposCompraParsed.includes("CPL") && (formularioNativo === "true" || formularioNativo === true);
      if (ehCPLNativo && !observacoesFormularioNativo?.trim()) {
        return res.status(400).json({ error: "Descreva o formulário nativo" });
      }
      const creative = await createCreative({
        file: req.file,
        cloudinaryUrl, cloudinaryPublicId, tipoMidia,
        nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
        periodoInicio, periodoFim, veiculo, plataforma, formato: formatoParsed, posicionamento,
        urlDestino,
        impulsionado: ehImpulsionado,
        segmentacao, titulo,
        tiposCompra: tiposCompraParsed,
        criadoPor: req.user.id,
        campanhaVeiculoId: campanhaVeiculoId || null,
        linkPostagem,
        formularioNativo,
        observacoesFormularioNativo,
        searchCampos: searchCampos ? JSON.parse(searchCampos) : undefined,
      });
      res.status(201).json(creative);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id",
  requireRole("agencia"),
  (req, res, next) => upload.single("file")(req, res, handleUploadErrors(req, res, next)),
  async (req, res, next) => {
    try {
      const { tiposCompra, impulsionado, searchCampos, formato, ...rest } = req.body;
      const updated = await updateCreative(req.params.id, {
        ...rest,
        file: req.file,
        impulsionado: impulsionado !== undefined ? impulsionado !== "false" : undefined,
        tiposCompra: tiposCompra ? JSON.parse(tiposCompra) : undefined,
        searchCampos: searchCampos !== undefined ? (searchCampos ? JSON.parse(searchCampos) : null) : undefined,
        formato: formato !== undefined ? (formato ? JSON.parse(formato) : undefined) : undefined,
      }, req.user.id);
      if (!updated) return res.status(404).json({ error: "Criativo não encontrado" });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// Exclusao em massa (Matriz de Conteudo): apaga varios criativos de uma vez.
// Precisa vir antes de "/:id" senao Express trataria "bulk" como um :id.
router.delete("/bulk", requireRole("agencia"), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Informe ao menos um id de criativo" });
    }
    const resultado = await deleteCreativesBulk(ids, req.user.id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteCreative(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: "Criativo não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", requireRole("veiculo", "agencia"), async (req, res, next) => {
  try {
    const { status } = req.body;
    const updated = await updateStatus(req.params.id, status, req.user);
    if (!updated) return res.status(404).json({ error: "Criativo não encontrado" });
    res.json(updated);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
