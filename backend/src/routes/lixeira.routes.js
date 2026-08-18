import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  listLixeiraCreatives,
  restaurarCreative,
  excluirCreativeDefinitivo,
} from "../services/creativesService.js";
import {
  listLixeiraCampanhas,
  restaurarCampanha,
  excluirCampanhaDefinitiva,
} from "../services/campanhasService.js";
import { listarAcoesLixeira, listarAcoesDeUsuarios } from "../services/actionLogService.js";

// Toda rota aqui exige agencia + is_admin=true -- ver requireAdmin em middleware/auth.js.
const router = Router();
router.use(requireAdmin);

router.get("/creatives", async (_req, res, next) => {
  try {
    res.json(await listLixeiraCreatives());
  } catch (err) {
    next(err);
  }
});

router.get("/campanhas", async (_req, res, next) => {
  try {
    res.json(await listLixeiraCampanhas());
  } catch (err) {
    next(err);
  }
});

router.post("/creatives/:id/restaurar", async (req, res, next) => {
  try {
    const restaurado = await restaurarCreative(req.params.id, req.user.id);
    if (!restaurado) return res.status(404).json({ error: "Criativo não encontrado na lixeira" });
    res.json(restaurado);
  } catch (err) {
    next(err);
  }
});

router.post("/campanhas/:id/restaurar", async (req, res, next) => {
  try {
    const restaurada = await restaurarCampanha(req.params.id, req.user.id);
    if (!restaurada) return res.status(404).json({ error: "Campanha não encontrada na lixeira" });
    res.json(restaurada);
  } catch (err) {
    next(err);
  }
});

router.delete("/creatives/:id", async (req, res, next) => {
  try {
    const excluido = await excluirCreativeDefinitivo(req.params.id, req.user.id);
    if (!excluido) return res.status(404).json({ error: "Criativo não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/campanhas/:id", async (req, res, next) => {
  try {
    const excluida = await excluirCampanhaDefinitiva(req.params.id, req.user.id);
    if (!excluida) return res.status(404).json({ error: "Campanha não encontrada" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Historico de acoes da Lixeira (restaurar/excluir definitivo), admin-only --
// nao aparece no ActionLogModal comum (ver filtro em listarAcoesPorCampanha).
router.get("/historico", async (_req, res, next) => {
  try {
    res.json(await listarAcoesLixeira());
  } catch (err) {
    next(err);
  }
});

// Historico de gestao de usuarios (criacao/exclusao de contas), admin-only.
router.get("/usuarios/historico", async (_req, res, next) => {
  try {
    res.json(await listarAcoesDeUsuarios());
  } catch (err) {
    next(err);
  }
});

export default router;
