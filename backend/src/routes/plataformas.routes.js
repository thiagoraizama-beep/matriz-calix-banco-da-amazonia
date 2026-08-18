import { Router } from "express";
import multer from "multer";
import { requireRole } from "../middleware/auth.js";
import { listPlataformas, createPlataforma, updatePlataforma, deletePlataforma } from "../services/plataformasService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Arquivo deve ser uma imagem"));
    cb(null, true);
  },
});

router.get("/", async (_req, res, next) => {
  try {
    res.json(await listPlataformas());
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("agencia"), upload.single("logo"), async (req, res, next) => {
  try {
    const { nome, tipo, subcanais } = req.body;
    if (!nome) return res.status(400).json({ error: "Campo obrigatório: nome" });
    const p = await createPlataforma({
      nome,
      tipo,
      subcanais: subcanais ? JSON.parse(subcanais) : [],
      file: req.file,
    });
    res.status(201).json(p);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Já existe uma plataforma com este nome" });
    next(err);
  }
});

router.put("/:id", requireRole("agencia"), upload.single("logo"), async (req, res, next) => {
  try {
    const { nome, tipo, subcanais, removerLogo } = req.body;
    const updated = await updatePlataforma(req.params.id, {
      nome,
      tipo,
      subcanais: subcanais ? JSON.parse(subcanais) : undefined,
      file: req.file,
      removerLogo: removerLogo === "true",
    });
    if (!updated) return res.status(404).json({ error: "Plataforma não encontrada" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deletePlataforma(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Plataforma não encontrada" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
