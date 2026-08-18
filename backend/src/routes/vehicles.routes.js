import { Router } from "express";
import multer from "multer";
import { requireRole } from "../middleware/auth.js";
import { listVehicles, createVehicle, updateVehicle, deleteVehicle } from "../services/vehiclesService.js";

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
    res.json(await listVehicles());
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("agencia"), upload.single("logo"), async (req, res, next) => {
  try {
    const { nome, tipo } = req.body;
    if (!nome) return res.status(400).json({ error: "Campo obrigatório: nome" });
    const vehicle = await createVehicle({ nome, tipo, file: req.file });
    res.status(201).json(vehicle);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("agencia"), upload.single("logo"), async (req, res, next) => {
  try {
    const { nome, tipo, removerLogo } = req.body;
    const updated = await updateVehicle(req.params.id, { nome, tipo, file: req.file, removerLogo: removerLogo === "true" });
    if (!updated) return res.status(404).json({ error: "Veículo não encontrado" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteVehicle(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Veículo não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
