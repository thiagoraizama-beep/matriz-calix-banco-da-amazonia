import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import {
  listParceiros,
  getParceiro,
  createParceiro,
  updateParceiro,
  deleteParceiro,
  upsertEscopo,
  deleteEscopo,
} from "../services/parceirosService.js";

const router = Router();

// Apenas agencia gerencia parceiros
router.get("/", requireRole("agencia"), async (_req, res, next) => {
  try {
    res.json(await listParceiros());
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("agencia"), async (req, res, next) => {
  try {
    const { nome, tipo } = req.body;
    if (!nome || !tipo) return res.status(400).json({ error: "Campos obrigatórios: nome, tipo" });
    const parceiro = await createParceiro({ nome, tipo });
    res.status(201).json(parceiro);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("agencia"), async (req, res, next) => {
  try {
    const updated = await updateParceiro(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Parceiro não encontrado" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteParceiro(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Parceiro não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Escopos: campanha + canais por parceiro
router.put("/:id/escopos", requireRole("agencia"), async (req, res, next) => {
  try {
    const { campanha, canais } = req.body;
    if (!campanha || !Array.isArray(canais)) {
      return res.status(400).json({ error: "Campos obrigatórios: campanha, canais (array)" });
    }
    const escopo = await upsertEscopo(Number(req.params.id), { campanha, canais });
    res.json(escopo);
  } catch (err) {
    next(err);
  }
});

router.delete("/escopos/:escopoId", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteEscopo(req.params.escopoId);
    if (!deleted) return res.status(404).json({ error: "Escopo não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
