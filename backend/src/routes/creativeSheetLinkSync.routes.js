import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  sincronizarLinksPublicacaoDeTodasAsCampanhas,
  sincronizarLinkPublicacaoDaPlanilha,
} from "../services/creativesSheetSyncService.js";

const router = Router();

// Chamado pelo Vercel Cron 1x/dia (ver vercel.json -- limite do plano
// gratuito da Vercel; pode ser aumentado se o plano virar Pro). Unica via
// PLANILHA -> SISTEMA hoje: le "Link da publicação" preenchido manualmente
// nas abas do Google Sheets e aplica em creatives.link_postagem (so em
// Impulsionados), casando cada linha pelo id oculto (ver COLUNA_ID em
// creativesSheetSyncService.js). Mesmo padrao de auth de statusSync.routes.js
// -- sem cookie de sessao, protegido por secret comparado via header Authorization.
router.get("/cron", async (req, res, next) => {
  try {
    const esperado = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || req.headers.authorization !== esperado) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    await sincronizarLinksPublicacaoDeTodasAsCampanhas();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Botao manual "Verificar links da planilha agora" -- enquanto o plano da
// Vercel nao permitir cron mais frequente que 1x/dia (ver vercel.json), este
// e o jeito de puxar a atualizacao sem esperar o cron diario.
router.post("/campanhas/:campanhaId", requireAuth, requireRole("agencia"), async (req, res, next) => {
  try {
    await sincronizarLinkPublicacaoDaPlanilha(req.params.campanhaId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
