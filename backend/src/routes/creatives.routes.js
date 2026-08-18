import { Router } from "express";
import multer from "multer";
import { requireRole } from "../middleware/auth.js";
import {
  listCreatives,
  listCreativesByCampanha,
  listCreativesAImplementar,
  listCreativesComErro,
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

router.get("/:id/history", async (req, res, next) => {
  try {
    res.json(await getStatusHistory(req.params.id));
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
      } = req.body;
      const ehImpulsionado = impulsionado !== "false";
      // "Impulsionado" parte de um post ja publicado organicamente -- exige o link
      // da postagem em vez de arquivo. "Dark Post" nao existe como post organico,
      // entao continua exigindo arquivo.
      if (ehImpulsionado && !linkPostagem?.trim()) {
        return res.status(400).json({ error: "Informe o link da postagem impulsionada" });
      }
      if (!ehImpulsionado && !req.file && !cloudinaryUrl) {
        return res.status(400).json({ error: "Arquivo obrigatório para Dark Post" });
      }
      if (!nome || !adName || !campanha || !veiculo) {
        return res.status(400).json({ error: "Campos obrigatórios: nome, adName, campanha, veiculo" });
      }
      if (!formato) {
        return res.status(400).json({ error: "Selecione o formato" });
      }
      if (periodoInicio && periodoFim && periodoInicio > periodoFim) {
        return res.status(400).json({ error: "A data inicial não pode ser depois da data final" });
      }
      const creative = await createCreative({
        file: req.file,
        cloudinaryUrl, cloudinaryPublicId, tipoMidia,
        nome, adName, campanha, campaignName, conjunto, descricao, observacoes,
        periodoInicio, periodoFim, veiculo, plataforma, formato, posicionamento,
        urlDestino,
        impulsionado: ehImpulsionado,
        segmentacao, titulo,
        tiposCompra: tiposCompra ? JSON.parse(tiposCompra) : [],
        criadoPor: req.user.id,
        campanhaVeiculoId: campanhaVeiculoId || null,
        linkPostagem,
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
      const { tiposCompra, impulsionado, ...rest } = req.body;
      const updated = await updateCreative(req.params.id, {
        ...rest,
        file: req.file,
        impulsionado: impulsionado !== undefined ? impulsionado !== "false" : undefined,
        tiposCompra: tiposCompra ? JSON.parse(tiposCompra) : undefined,
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
