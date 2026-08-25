import { Router } from "express";
import { verificarTokenDownload } from "../services/authService.js";
import { getCreativeById } from "../services/creativesService.js";
import { gerarZipDoCreative } from "../services/creativeFilesService.js";

// Router SEM requireAuth -- montado em /api/download/creatives (prefixo
// proprio, separado de /api/creatives que exige sessao). Usado pro link
// "Link da peça" do Excel exportado, que precisa funcionar clicando direto
// (o navegador que abre o link nao tem o cookie de sessao do app). Se
// autentica via token proprio (?token=..., ver gerarTokenDownload), escopado
// so pra baixar aquele criativo especifico -- nao um login completo.
const router = Router();

router.get("/creatives/:id/files/zip", async (req, res, next) => {
  try {
    verificarTokenDownload(req.query.token, req.params.id);
  } catch {
    return res.status(401).json({ error: "Link de download inválido ou expirado" });
  }
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

export default router;
