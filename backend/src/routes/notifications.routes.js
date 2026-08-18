import { Router } from "express";
import { listNotificacoesMencao, marcarNotificacaoLida } from "../services/commentsService.js";

const router = Router();

router.get("/mentions", async (req, res, next) => {
  try {
    res.json(await listNotificacoesMencao(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.patch("/mentions/:id/read", async (req, res, next) => {
  try {
    const ok = await marcarNotificacaoLida(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: "Notificação não encontrada" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
