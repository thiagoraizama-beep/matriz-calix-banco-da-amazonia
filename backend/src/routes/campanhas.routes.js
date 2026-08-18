import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import {
  listCampanhas,
  listCampanhasHome,
  createCampanha,
  updateCampanhaNome,
  updateCampanhaStatus,
  deleteCampanha,
  upsertCampanhaVeiculo,
  deleteCampanhaVeiculo,
  upsertMetaPlataforma,
  deleteMetaPlataforma,
  updateGa4PropertyId,
  upsertCampanhaSheet,
  deleteCampanhaSheet,
} from "../services/campanhasService.js";
import { fetchSheetHeaders, invalidateCache } from "../services/sheetsClient.js";
import { listarAcoesPorCampanha } from "../services/actionLogService.js";

const router = Router();

// Home pos-login: lista campanhas paginada/pesquisavel, ja escopada pelo papel do
// usuario (agencia/cliente veem tudo; veiculo/parceiro so os seus vinculos).
router.get("/home", async (req, res, next) => {
  try {
    const { busca, status, page, pageSize } = req.query;
    const result = await listCampanhasHome(req.user, {
      busca: busca || "",
      status: status || "",
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// E-mail da conta de servico do Google usada para ler o GA4 -- precisa ser adicionada
// como usuaria (Visualizador) em cada property GA4 vinculada, senao a leitura falha por
// permissao mesmo com o Property ID certo cadastrado. So o e-mail, nunca a chave privada.
router.get("/ga4-service-account", requireRole("agencia"), (_req, res) => {
  res.json({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null });
});

// Preview dos headers reais de uma planilha/aba, usado na tela de vinculo (Perfil >
// Integrações de Planilha) para popular os dropdowns de mapeamento ANTES de salvar
// o vinculo -- por isso nao e escopado a uma campanha ainda. Precisa vir antes de
// qualquer rota "/:id/..." abaixo, senao Express trataria "sheets" como um :id.
router.post("/sheets/headers", requireRole("agencia"), async (req, res, next) => {
  try {
    const { spreadsheetId, range } = req.body;
    if (!spreadsheetId || !range) {
      return res.status(400).json({ error: "Informe o ID da planilha e o nome da aba" });
    }
    const headers = await fetchSheetHeaders(spreadsheetId, range);
    res.json({ headers });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/", async (_req, res, next) => {
  try {
    res.json(await listCampanhas());
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("agencia"), async (req, res, next) => {
  try {
    const { nome, dataInicio, dataFim } = req.body;
    if (!nome) return res.status(400).json({ error: "Campo obrigatório: nome" });
    const campanha = await createCampanha(nome, { dataInicio, dataFim }, req.user.id);
    res.status(201).json(campanha);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Já existe uma campanha com este nome" });
    }
    next(err);
  }
});

router.put("/:id", requireRole("agencia"), async (req, res, next) => {
  try {
    const { nome, dataInicio, dataFim } = req.body;
    if (!nome) return res.status(400).json({ error: "Campo obrigatório: nome" });
    const updated = await updateCampanhaNome(req.params.id, nome, { dataInicio, dataFim }, req.user.id);
    if (!updated) return res.status(404).json({ error: "Campanha não encontrada" });
    res.json(updated);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Já existe uma campanha com este nome" });
    }
    next(err);
  }
});

router.patch("/:id/status", requireRole("agencia"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["ativo", "pausado", "em_analise", "agendado", "programado", "aprovado", "cancelado", "finalizado"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }
    const updated = await updateCampanhaStatus(req.params.id, status, req.user.id);
    if (!updated) return res.status(404).json({ error: "Campanha não encontrada" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Vincula/desvincula o Property ID do GA4 (Perfil > Integrações GA4).
router.patch("/:id/ga4", requireRole("agencia"), async (req, res, next) => {
  try {
    const { ga4PropertyId } = req.body;
    const updated = await updateGa4PropertyId(req.params.id, ga4PropertyId, req.user.id);
    if (!updated) return res.status(404).json({ error: "Campanha não encontrada" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Cria/atualiza o vinculo de planilha desta campanha (Perfil > Integrações de
// Planilha). Invalida o cache de serie diaria dela na hora -- uma edicao de
// mapeamento reflete no proximo carregamento, sem esperar o TTL de 60s.
router.put("/:id/sheet", requireRole("agencia"), async (req, res, next) => {
  try {
    const { spreadsheetId, range, mapping } = req.body;
    if (!spreadsheetId || !range || !mapping?.data || !mapping?.plataforma || !mapping?.investimento || !mapping?.impressoes || !mapping?.cliques) {
      return res.status(400).json({
        error: "Informe a planilha, a aba e o mapeamento das colunas obrigatórias (Data, Plataforma, Investimento, Impressões, Cliques)",
      });
    }
    const saved = await upsertCampanhaSheet(req.params.id, { spreadsheetId, range, mapping });
    invalidateCache(req.params.id);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// Remove o vinculo de planilha desta campanha.
router.delete("/:id/sheet", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteCampanhaSheet(req.params.id);
    invalidateCache(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Vínculo de planilha não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteCampanha(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: "Campanha não encontrada" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Log de auditoria da campanha (criativos + a propria campanha): criacao, edicao
// campo a campo, mudanca de status e exclusao, manual ou automatica. So agencia
// ve -- qualquer um dos agentes ve as acoes de todos os outros.
router.get("/:campanhaId/action-log", requireRole("agencia"), async (req, res, next) => {
  try {
    res.json(await listarAcoesPorCampanha(req.params.campanhaId));
  } catch (err) {
    next(err);
  }
});

// Vincula um veículo a uma campanha com plataformas específicas e tipo de mídia
router.put("/:id/veiculos", requireRole("agencia"), async (req, res, next) => {
  try {
    const { vehicleId, plataformas, tipoMidia, acessoAnaliseCriativo, acessoMatriz, plataformasAnaliseCriativo } = req.body;
    if (!vehicleId || !Array.isArray(plataformas)) {
      return res.status(400).json({ error: "Campos obrigatórios: vehicleId, plataformas (array)" });
    }
    const result = await upsertCampanhaVeiculo(req.params.id, vehicleId, plataformas, tipoMidia, {
      acessoAnaliseCriativo,
      acessoMatriz,
      plataformasAnaliseCriativo,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Remove vínculo veículo de campanha
router.delete("/veiculos/:vinculoId", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteCampanhaVeiculo(req.params.vinculoId);
    if (!deleted) return res.status(404).json({ error: "Vínculo não encontrado" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Cadastra/atualiza a meta (quantidade contratada + modelo de compra + periodo)
// de uma plataforma especifica dentro de um vinculo campanha+veiculo.
router.put("/veiculos/:vinculoId/metas/:plataforma", requireRole("agencia"), async (req, res, next) => {
  try {
    const { quantidadeContratada, modeloCompra, dataInicio, dataFim } = req.body;
    const result = await upsertMetaPlataforma(req.params.vinculoId, req.params.plataforma, {
      quantidadeContratada,
      modeloCompra,
      dataInicio,
      dataFim,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete("/veiculos/metas/:metaId", requireRole("agencia"), async (req, res, next) => {
  try {
    const deleted = await deleteMetaPlataforma(req.params.metaId);
    if (!deleted) return res.status(404).json({ error: "Meta não encontrada" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
