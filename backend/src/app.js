import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import creativeAnalysisRoutes from "./routes/creativeAnalysis.routes.js";
import authRoutes from "./routes/auth.routes.js";
import creativesRoutes from "./routes/creatives.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";
import parceirosRoutes from "./routes/parceiros.routes.js";
import campanhasRoutes from "./routes/campanhas.routes.js";
import plataformasRoutes from "./routes/plataformas.routes.js";
import statusSyncRoutes from "./routes/statusSync.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import lixeiraRoutes from "./routes/lixeira.routes.js";
import creativesDownloadRoutes from "./routes/creativesDownload.routes.js";
import creativeSheetLinkSyncRoutes from "./routes/creativeSheetLinkSync.routes.js";
import { requireAuth } from "./middleware/auth.js";

export const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);
// Sem requireAuth -- links de download com token proprio (ver
// creativesDownload.routes.js), pensados pra abrir fora do app (ex: clicado
// de dentro do Excel exportado).
app.use("/api/download", creativesDownloadRoutes);
app.use("/api/creatives", requireAuth, creativesRoutes);
app.use("/api/vehicles", requireAuth, vehiclesRoutes);
app.use("/api/parceiros", requireAuth, parceirosRoutes);
app.use("/api/campanhas", requireAuth, campanhasRoutes);
app.use("/api/plataformas", requireAuth, plataformasRoutes);
app.use("/api/notifications", requireAuth, notificationsRoutes);
app.use("/api/lixeira", requireAuth, lixeiraRoutes);

app.use("/api/creative-analysis", requireAuth, creativeAnalysisRoutes);
// Sem requireAuth aqui: a rota /cron dentro deste router e chamada pelo Vercel Cron
// (sem cookie de sessao) e se autentica via CRON_SECRET; a rota /campanhas/:id aplica
// requireAuth internamente.
app.use("/api/status-sync", statusSyncRoutes);
// Mesmo padrao acima -- so a rota /cron, autenticada por CRON_SECRET.
app.use("/api/creative-sheet-link-sync", creativeSheetLinkSyncRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || "Erro interno" });
});
