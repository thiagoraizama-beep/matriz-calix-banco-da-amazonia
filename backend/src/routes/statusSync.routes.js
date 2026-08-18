import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { syncStatusCriativos } from "../services/statusSyncService.js";
import { scopeCampanhaFilter, temAcessoFeature } from "../utils/scopeFilter.js";
import { getCampanhaById } from "../services/campanhasService.js";

const router = Router();

// Chamada pelo Vercel Cron (sem cookie de sessao) -- protegida por secret comparado
// via header Authorization, nunca por requireAuth. Varre todas as campanhas ativas.
router.get("/cron", async (req, res, next) => {
  try {
    const esperado = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || req.headers.authorization !== esperado) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    const resultado = await syncStatusCriativos({ origem: "cron" });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// Botao manual "Sincronizar status" na Matriz de uma campanha especifica.
// Agencia sempre pode; veiculo/parceiro so se o vinculo daquela campanha tiver
// acesso_matriz liberado (mesma feature que controla o CRUD/status na Matriz).
router.post("/campanhas/:campanhaId", requireAuth, async (req, res, next) => {
  try {
    if (!temAcessoFeature(req.user, "acessoMatriz")) {
      return res.status(403).json({ error: "Acesso não permitido" });
    }

    const campanha = await getCampanhaById(req.params.campanhaId);
    if (!campanha) return res.status(404).json({ error: "Campanha não encontrada" });

    if (req.user.papel === "veiculo" || req.user.papel === "parceiro") {
      const campanhasPermitidas = scopeCampanhaFilter(req.user, null);
      if (!campanhasPermitidas.includes(campanha.nome)) {
        return res.status(403).json({ error: "Acesso não permitido a esta campanha" });
      }
    }

    const resultado = await syncStatusCriativos({
      campanhaId: req.params.campanhaId,
      origem: "manual",
      disparadoPor: req.user.id,
    });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

export default router;
