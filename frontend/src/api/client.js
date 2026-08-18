import axios from "axios";

// Serializa arrays como "chave=valor1&chave=valor2" (sem o "[]" que o axios usa por padrao).
// Necessario porque na Vercel o req.query e populado pelo parser nativo do Node antes do
// Express, e esse parser nao entende a notacao "chave[]=valor" para arrays.
function serializeParams(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
    } else {
      search.append(key, value);
    }
  }
  return search.toString();
}

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  paramsSerializer: { serialize: serializeParams },
});

export function getMediaSummary(range, isFiltered, campanha, veiculo, modeloCompra) {
  return api
    .get("/media/summary", { params: { ...range, isFiltered, campanha, veiculo, modeloCompra } })
    .then((r) => r.data);
}

export function getCampaignStatus() {
  return api.get("/media/campaign-status").then((r) => r.data);
}

export function getAvailableDateRange(campanha, veiculo, modeloCompra) {
  return api.get("/media/available-range", { params: { campanha, veiculo, modeloCompra } }).then((r) => r.data);
}

export function getPerformanceSeries(range, isFiltered, metrics, campanha, veiculo, modeloCompra) {
  return api
    .get("/media/performance", {
      params: { ...range, isFiltered, metrics: metrics?.join(","), campanha, veiculo, modeloCompra },
    })
    .then((r) => r.data);
}

export function getSiteSummary(range, campanha, veiculo) {
  return api.get("/site/summary", { params: { ...range, campanha, veiculo } }).then((r) => r.data);
}

export function getDealsProgress(range, isFiltered, campanha, veiculo, modeloCompra) {
  return api
    .get("/deals/progress", { params: { ...range, isFiltered, campanha, veiculo, modeloCompra } })
    .then((r) => r.data);
}

export function getVehicles(range, isFiltered, campanha, veiculo, modeloCompra) {
  return api
    .get("/deals/vehicles", { params: { ...range, isFiltered, campanha, veiculo, modeloCompra } })
    .then((r) => r.data);
}

export function getOfflineFilterOptions() {
  return api.get("/offline-media/filter-options").then((r) => r.data);
}

export function getOfflineSummary(filters) {
  return api.get("/offline-media/summary", { params: filters }).then((r) => r.data);
}

export function getOfflineCategories(filters) {
  return api.get("/offline-media/categories", { params: filters }).then((r) => r.data);
}

// Alertas do sino de notificacoes: criativos com status "Com erro" (atribuido so
// manualmente), visiveis ao usuario logado.
export function getCreativesComErro() {
  return api.get("/creatives/alertas").then((r) => r.data);
}

export function getProgramasList() {
  return api.get("/programacoes/programas").then((r) => r.data);
}

export function createProgramacao(payload) {
  return api.post("/programacoes", payload).then((r) => r.data);
}

export function updateProgramacao(id, payload) {
  return api.put(`/programacoes/${id}`, payload).then((r) => r.data);
}

export function deleteProgramacao(id) {
  return api.delete(`/programacoes/${id}`).then((r) => r.data);
}

export function getCreativeFilterOptions(campanhaId, veiculo) {
  return api.get(`/creative-analysis/${campanhaId}/${veiculo}/filter-options`).then((r) => r.data);
}

export function getCampanhaSummary(campanhaId) {
  return api.get(`/creative-analysis/${campanhaId}/campaign-summary`).then((r) => r.data);
}

export function getCampanhaSeries(campanhaId) {
  return api.get(`/creative-analysis/${campanhaId}/campaign-series`).then((r) => r.data);
}

export function getPlataformaSeries(campanhaId, veiculo) {
  return api.get(`/creative-analysis/${campanhaId}/${veiculo}/series`).then((r) => r.data);
}

export function getCreativeSummary(campanhaId, veiculo, filters) {
  return api.get(`/creative-analysis/${campanhaId}/${veiculo}/summary`, { params: filters }).then((r) => r.data);
}

export function getCreatives(campanhaId, veiculo, filters) {
  return api.get(`/creative-analysis/${campanhaId}/${veiculo}/creatives`, { params: filters }).then((r) => r.data);
}

// Performance de UM criativo especifico (por Ad Name), buscada sob demanda ao abrir
// o detalhe de um criativo cadastrado na Matriz -- retorna null se nao houver dado.
export function getCreativeByAdName(campanhaId, veiculo, adName, filters) {
  return api
    .get(`/creative-analysis/${campanhaId}/${veiculo}/creatives/${encodeURIComponent(adName)}/summary`, { params: filters })
    .then((r) => r.data);
}

// Performance de todos os criativos cadastrados de uma campanha, numa unica chamada
// (mapa por creative.id) -- usado pelos cards da Matriz pra metricas inline.
export function getPerformancePorCampanha(campanhaId) {
  return api.get(`/creative-analysis/${campanhaId}/performance-por-criativo`).then((r) => r.data);
}

export function getCreativeSeries(campanhaId, veiculo, adName, filters) {
  return api
    .get(`/creative-analysis/${campanhaId}/${veiculo}/creatives/${encodeURIComponent(adName)}/series`, { params: filters })
    .then((r) => r.data);
}

export function login(email, senha) {
  return api.post("/auth/login", { email, senha }).then((r) => r.data);
}

export function logout() {
  return api.post("/auth/logout").then((r) => r.data);
}

export function getMe() {
  return api.get("/auth/me").then((r) => r.data);
}

export function getPublicAvatar(email) {
  return api.get("/auth/avatar", { params: { email } }).then((r) => r.data);
}

export function requestPasswordReset(email) {
  return api.post("/auth/password-reset/request", { email }).then((r) => r.data);
}

export function validateResetToken(token) {
  return api.get("/auth/password-reset/validate", { params: { token } }).then((r) => r.data);
}

export function confirmPasswordReset(token, novaSenha) {
  return api.post("/auth/password-reset/confirm", { token, novaSenha }).then((r) => r.data);
}

export function getUsers() {
  return api.get("/auth/users").then((r) => r.data);
}

export function createUserAccount(payload) {
  return api.post("/auth/users", payload).then((r) => r.data);
}

export function deleteUserAccount(id) {
  return api.delete(`/auth/users/${id}`).then((r) => r.data);
}

export function updateUserRoleAccount(id, payload) {
  return api.put(`/auth/users/${id}/role`, payload).then((r) => r.data);
}

export function updateUserAccount(id, payload) {
  return api.put(`/auth/users/${id}`, payload).then((r) => r.data);
}

export function changeMyPassword(senhaAtual, novaSenha) {
  return api.put("/auth/me/password", { senhaAtual, novaSenha }).then((r) => r.data);
}

export function updateMyProfile(formData) {
  return api.put("/auth/me", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
}

export function getMatrixCreatives() {
  return api.get("/creatives").then((r) => r.data);
}

// Criativos de UMA campanha especifica -- usado pela Matriz por campanha (nunca
// carrega todos os criativos do sistema de uma vez).
export function getCreativesByCampanha(campanhaId) {
  return api.get("/creatives", { params: { campanhaId } }).then((r) => r.data);
}

// Criativos urgentes (periodo_inicio hoje/amanha) de TODAS as campanhas do usuario --
// tela global "A implementar" (so agencia/veiculo).
export function getCreativesAImplementar() {
  return api.get("/creatives/a-implementar").then((r) => r.data);
}

export function getCreativeHistory(id) {
  return api.get(`/creatives/${id}/history`).then((r) => r.data);
}

export function createMatrixCreative(formData) {
  return api.post("/creatives", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
}

export function updateMatrixCreative(id, payload) {
  return api.put(`/creatives/${id}`, payload).then((r) => r.data);
}

export function deleteMatrixCreative(id) {
  return api.delete(`/creatives/${id}`).then((r) => r.data);
}

export function updateMatrixCreativeStatus(id, status) {
  return api.patch(`/creatives/${id}/status`, { status }).then((r) => r.data);
}

// Edicao em massa: aplica o mesmo patch (status e/ou outros campos do formulario)
// a varios criativos de uma vez.
export function bulkUpdateCreatives(ids, patch) {
  return api.patch("/creatives/bulk", { ids, patch }).then((r) => r.data);
}

// Exclusao em massa: apaga varios criativos de uma vez.
export function bulkDeleteCreatives(ids) {
  return api.delete("/creatives/bulk", { data: { ids } }).then((r) => r.data);
}

export function getRegisteredVehicles() {
  return api.get("/vehicles").then((r) => r.data);
}

// Parceiros (empresas veiculadoras)
export function getParceiros() {
  return api.get("/parceiros").then((r) => r.data);
}

export function createParceiro(payload) {
  return api.post("/parceiros", payload).then((r) => r.data);
}

export function updateParceiro(id, payload) {
  return api.put(`/parceiros/${id}`, payload).then((r) => r.data);
}

export function deleteParceiro(id) {
  return api.delete(`/parceiros/${id}`).then((r) => r.data);
}

export function upsertEscopoParaceiro(parceiroId, payload) {
  return api.put(`/parceiros/${parceiroId}/escopos`, payload).then((r) => r.data);
}

export function deleteEscopoParceiroById(escopoId) {
  return api.delete(`/parceiros/escopos/${escopoId}`).then((r) => r.data);
}

// Campanhas
// Sem cache: usado pela tela de Integracoes GA4 logo apos salvar um Property ID,
// que precisa refletir o dado novo na hora (nao uma resposta OK antiga que o
// navegador guardou em cache HTTP para este GET, o que fazia o campo parecer
// "nao salvar" mesmo com o valor ja persistido no banco).
export function getCampanhas() {
  return api.get("/campanhas", { params: { _: Date.now() } }).then((r) => r.data);
}

// Home pos-login: lista campanhas paginada/pesquisavel (ja escopada por papel).
export function getCampanhasHome({ busca, status, page, pageSize } = {}) {
  return api.get("/campanhas/home", { params: { busca, status, page, pageSize } }).then((r) => r.data);
}

export function syncCampanhaStatus(campanhaId) {
  return api.post(`/status-sync/campanhas/${campanhaId}`).then((r) => r.data);
}

export function createCampanha(nome, dataInicio, dataFim) {
  return api.post("/campanhas", { nome, dataInicio: dataInicio || null, dataFim: dataFim || null }).then((r) => r.data);
}

export function updateCampanhaNome(id, nome, dataInicio, dataFim) {
  return api.put(`/campanhas/${id}`, { nome, dataInicio: dataInicio || null, dataFim: dataFim || null }).then((r) => r.data);
}

export function updateCampanhaStatus(id, status) {
  return api.patch(`/campanhas/${id}/status`, { status }).then((r) => r.data);
}

export function deleteCampanha(id) {
  return api.delete(`/campanhas/${id}`).then((r) => r.data);
}

// Log de auditoria (criativos + campanha): criacao, edicao campo a campo,
// mudanca de status e exclusao, manual ou automatica.
export function getCampanhaActionLog(campanhaId) {
  return api.get(`/campanhas/${campanhaId}/action-log`).then((r) => r.data);
}

// GA4: vincula o Property ID de uma propriedade GA4 a uma campanha (usado para
// resolver sessoes/leads por criativo, casados pela URL de destino cadastrada).
export function getGa4ServiceAccount() {
  return api.get("/campanhas/ga4-service-account").then((r) => r.data);
}

export function updateGa4PropertyId(id, ga4PropertyId) {
  return api.patch(`/campanhas/${id}/ga4`, { ga4PropertyId }).then((r) => r.data);
}

// Planilha por campanha: cada campanha pode ter sua propria planilha Google Sheets,
// com mapeamento de colunas configuravel (ja que o layout varia entre campanhas).
export function getSheetHeaders(spreadsheetId, range) {
  return api.post("/campanhas/sheets/headers", { spreadsheetId, range }).then((r) => r.data);
}

export function saveCampanhaSheet(id, { spreadsheetId, range, mapping }) {
  return api.put(`/campanhas/${id}/sheet`, { spreadsheetId, range, mapping }).then((r) => r.data);
}

export function deleteCampanhaSheet(id) {
  return api.delete(`/campanhas/${id}/sheet`).then((r) => r.data);
}

export function upsertCampanhaVeiculo(campanhaId, vehicleId, plataformas, tipoMidia, permissoes = {}) {
  return api
    .put(`/campanhas/${campanhaId}/veiculos`, {
      vehicleId,
      plataformas,
      tipoMidia,
      acessoAnaliseCriativo: permissoes.acessoAnaliseCriativo,
      acessoMatriz: permissoes.acessoMatriz,
      plataformasAnaliseCriativo: permissoes.plataformasAnaliseCriativo,
    })
    .then((r) => r.data);
}

export function deleteCampanhaVeiculo(vinculoId) {
  return api.delete(`/campanhas/veiculos/${vinculoId}`).then((r) => r.data);
}

export function upsertMetaPlataforma(vinculoId, plataforma, { quantidadeContratada, modeloCompra, dataInicio, dataFim }) {
  return api
    .put(`/campanhas/veiculos/${vinculoId}/metas/${encodeURIComponent(plataforma)}`, {
      quantidadeContratada,
      modeloCompra,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
    })
    .then((r) => r.data);
}

export function deleteMetaPlataforma(metaId) {
  return api.delete(`/campanhas/veiculos/metas/${metaId}`).then((r) => r.data);
}

// Plataformas
export function getPlataformas() {
  return api.get("/plataformas").then((r) => r.data);
}

export function createPlataforma(payload) {
  return api.post("/plataformas", payload).then((r) => r.data);
}

export function updatePlataforma(id, payload) {
  return api.put(`/plataformas/${id}`, payload).then((r) => r.data);
}

export function deletePlataforma(id) {
  return api.delete(`/plataformas/${id}`).then((r) => r.data);
}

export function createVehicle(formData) {
  return api.post("/vehicles", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
}

export function updateVehicle(id, formData) {
  return api.put(`/vehicles/${id}`, formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
}

export function deleteVehicle(id) {
  return api.delete(`/vehicles/${id}`).then((r) => r.data);
}
