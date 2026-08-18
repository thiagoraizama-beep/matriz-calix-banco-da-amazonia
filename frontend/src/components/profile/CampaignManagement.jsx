import { useEffect, useState } from "react";
import {
  getCampanhas,
  createCampanha,
  updateCampanhaNome,
  updateCampanhaStatus,
  deleteCampanha,
  upsertCampanhaVeiculo,
  deleteCampanhaVeiculo,
  upsertMetaPlataforma,
  deleteMetaPlataforma,
  getRegisteredVehicles,
  getPlataformas,
} from "../../api/client.js";
import SearchSelect from "../layout/SearchSelect.jsx";
import MultiSelectDropdown from "../layout/MultiSelectDropdown.jsx";
import SimpleDateRangeFields from "../layout/SimpleDateRangeFields.jsx";
import CampaignStatusDropdown from "./CampaignStatusDropdown.jsx";
import Spinner from "../common/Spinner.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import TrashIcon from "../common/TrashIcon.jsx";

const TIPO_MIDIA_OPTIONS = ["Online", "Offline", "Online e Offline"];
const TIPO_MIDIA_FROM_LABEL = { Online: "online", Offline: "offline", "Online e Offline": "ambos" };
const TIPO_MIDIA_LABEL = { online: "Online", offline: "Offline", ambos: "Online e Offline" };
const MODELO_COMPRA_OPTIONS = ["CPC", "CPM", "CPV", "CPE", "CPL", "CPT", "CPF", "CPA"];

function metaVazia() {
  return { quantidadeContratada: "", modeloCompra: "CPM", periodoProprio: false, dataInicio: "", dataFim: "" };
}

export default function CampaignManagement() {
  const [campanhas, setCampanhas] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [plataformasDb, setPlataformasDb] = useState([]);
  const [criando, setCriando] = useState(false);
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [dataInicioCampanha, setDataInicioCampanha] = useState("");
  const [dataFimCampanha, setDataFimCampanha] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingCampanha, setDeletingCampanha] = useState(null);

  function load() {
    setCampanhas(null);
    Promise.all([getCampanhas(), getRegisteredVehicles(), getPlataformas()]).then(([c, v, p]) => {
      setCampanhas(c);
      setVehicles(v);
      setPlataformasDb(p);
    });
  }

  useEffect(() => { load(); }, []);

  async function handleCriar(e) {
    e.preventDefault();
    if (!nomeCampanha.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createCampanha(nomeCampanha.trim(), dataInicioCampanha, dataFimCampanha);
      setNomeCampanha("");
      setDataInicioCampanha("");
      setDataFimCampanha("");
      setCriando(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar campanha");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDeleteCampanha() {
    await deleteCampanha(deletingCampanha.id);
    setDeletingCampanha(null);
    load();
  }

  async function handleChangeStatus(campanhaId, novoStatus) {
    await updateCampanhaStatus(campanhaId, novoStatus);
    load();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p className="card-title" style={{ margin: 0 }}>Campanhas</p>
        <button
          onClick={() => { setCriando((o) => !o); setError(""); setNomeCampanha(""); }}
          style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {criando ? "Cancelar" : "+ Nova campanha"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 16px" }}>
        Cadastre campanhas e vincule os veículos com as plataformas e o tipo de mídia (online/offline) que cada um trabalha nesta campanha específica.
      </p>

      {criando && (
        <form onSubmit={handleCriar} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={nomeCampanha}
            onChange={(e) => setNomeCampanha(e.target.value)}
            placeholder="Nome da campanha (ex: Campanha Institucional 2026)"
            required
            autoFocus
            style={{ flex: "1 1 240px", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
          />
          <SimpleDateRangeFields
            start={dataInicioCampanha}
            end={dataFimCampanha}
            onChange={(s, e) => { setDataInicioCampanha(s); setDataFimCampanha(e); }}
          />
          <button
            type="submit"
            disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {saving ? "..." : "Criar"}
          </button>
        </form>
      )}
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "-8px 0 12px" }}>{error}</p>}

      {!campanhas ? (
        <Spinner />
      ) : campanhas.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Nenhuma campanha cadastrada. Crie uma campanha e vincule os veículos.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campanhas.map((campanha) => (
            <CampanhaCard
              key={campanha.id}
              campanha={campanha}
              vehicles={vehicles}
              plataformasDb={plataformasDb}
              onChanged={load}
              onDelete={() => setDeletingCampanha(campanha)}
              onChangeStatus={(status) => handleChangeStatus(campanha.id, status)}
            />
          ))}
        </div>
      )}

      {deletingCampanha && (
        <ConfirmDialog
          title="Excluir campanha"
          message={`Excluir a campanha "${deletingCampanha.nome}"? Os vínculos com veículos serão removidos.`}
          onConfirm={handleConfirmDeleteCampanha}
          onCancel={() => setDeletingCampanha(null)}
        />
      )}
    </div>
  );
}

function CampanhaCard({ campanha, vehicles, plataformasDb, onChanged, onDelete, onChangeStatus }) {
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEditado, setNomeEditado] = useState(campanha.nome);
  const [dataInicioEditada, setDataInicioEditada] = useState(campanha.data_inicio?.slice(0, 10) || "");
  const [dataFimEditada, setDataFimEditada] = useState(campanha.data_fim?.slice(0, 10) || "");
  const [vinculoForm, setVinculoForm] = useState(null); // null | { vinculoId?, vehicleId, tipoMidia, plataformas }
  const [metaIdsOriginais, setMetaIdsOriginais] = useState([]); // ids de metas ja cadastradas ao abrir o form, usado para detectar remocao
  // Controla, por plataforma, se o bloco de meta contratada esta expandido nesta
  // sessao do formulario -- comeca fechado (so um botao "+ Definir meta") a menos
  // que ja haja meta preenchida, ja que nem todo veiculo/plataforma trabalha com
  // meta de volume contratado (alguns sao so performance).
  const [metaAberta, setMetaAberta] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removendoVinculo, setRemovendoVinculo] = useState(null); // { vinculoId, nomeVeiculo }

  // Veículos ainda não vinculados a esta campanha (para o form de novo vínculo)
  const vinculadosIds = campanha.veiculos.map((v) => v.vehicleId);
  const vehiclesDisponiveis = vehicles.filter((v) => !vinculadosIds.includes(v.id));

  const vehicleSelecionado = vinculoForm
    ? vehicles.find((v) => v.id === vinculoForm.vehicleId)
    : null;

  function plataformasParaTipo(tipoMidia) {
    return plataformasDb
      .filter((p) => {
        if (tipoMidia === "online") return p.tipo === "online" || p.tipo === "ambos";
        if (tipoMidia === "offline") return p.tipo === "offline" || p.tipo === "ambos";
        return true;
      })
      .map((p) => p.nome);
  }

  function abrirNovoVinculo() {
    setVinculoForm({
      vinculoId: null,
      vehicleId: null,
      tipoMidia: "online",
      plataformas: [],
      acessoAnaliseCriativo: true,
      acessoMatriz: true,
      plataformasAnaliseCriativo: [],
      metas: {},
      // acessoAnaliseCriativo/plataformasAnaliseCriativo continuam sendo enviados
      // ao backend (a feature Analise por Criativo ainda existe no sistema), mas
      // esta tela nao expoe mais o controle -- todo veiculo vinculado tem acesso
      // completo, so "Matriz de Conteudo" fica configuravel aqui.
    });
    setMetaIdsOriginais([]);
    setMetaAberta({});
    setError("");
  }

  function abrirEdicaoVinculo(v) {
    // Preenche a LISTA de metas ja cadastradas por plataforma (uma plataforma pode
    // ter varias metas simultaneas, uma por modelo de compra -- ex: Meta Ads com
    // CPM e CPC ao mesmo tempo). Plataforma sem nenhuma meta ainda entra com uma
    // meta vazia para o usuario preencher.
    const metas = {};
    for (const p of v.plataformas || []) {
      const existentes = (v.metas || []).filter((m) => m.plataforma === p);
      metas[p] = existentes.length
        ? existentes.map((existente) => ({
            metaId: existente.id,
            quantidadeContratada: String(existente.quantidadeContratada ?? ""),
            modeloCompra: existente.modeloCompra || "CPM",
            periodoProprio: Boolean(existente.dataInicio || existente.dataFim),
            dataInicio: existente.dataInicio?.slice(0, 10) || "",
            dataFim: existente.dataFim?.slice(0, 10) || "",
          }))
        : [metaVazia()];
    }

    setVinculoForm({
      vinculoId: v.id,
      vehicleId: v.vehicleId,
      tipoMidia: v.tipoMidia || "online",
      plataformas: v.plataformas,
      acessoAnaliseCriativo: true,
      acessoMatriz: v.acessoMatriz !== false,
      // A tela nao expoe mais escolher plataformas por analise separadamente --
      // acompanha sempre todas as plataformas do vinculo.
      plataformasAnaliseCriativo: v.plataformas || [],
      metas,
    });
    setMetaIdsOriginais((v.metas || []).map((m) => m.id));
    setMetaAberta({});
    setError("");
  }

  async function handleSalvarNome(e) {
    e.preventDefault();
    if (!nomeEditado.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateCampanhaNome(campanha.id, nomeEditado.trim(), dataInicioEditada, dataFimEditada);
      setEditandoNome(false);
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar nome");
    } finally {
      setSaving(false);
    }
  }

  async function handleVincular(e) {
    e.preventDefault();
    if (!vinculoForm.vehicleId || vinculoForm.plataformas.length === 0) {
      setError("Selecione o veículo e ao menos uma plataforma");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const vinculo = await upsertCampanhaVeiculo(campanha.id, vinculoForm.vehicleId, vinculoForm.plataformas, vinculoForm.tipoMidia, {
        acessoAnaliseCriativo: vinculoForm.acessoAnaliseCriativo,
        acessoMatriz: vinculoForm.acessoMatriz,
        plataformasAnaliseCriativo: vinculoForm.plataformasAnaliseCriativo,
      });
      const vinculoId = vinculoForm.vinculoId || vinculo.id;

      // Metas removidas na tela: existiam ao abrir o form (metaIdsOriginais) mas
      // nao sobraram em nenhuma plataforma atual -- precisam ser deletadas, senao
      // o upsert (que so cria/atualiza por plataforma+modeloCompra) nunca as toca
      // e elas "voltam" ao reabrir o formulario.
      const metaIdsRestantes = new Set(
        vinculoForm.plataformas.flatMap((p) => (vinculoForm.metas[p] || []).map((m) => m.metaId).filter(Boolean))
      );
      const metaIdsParaRemover = metaIdsOriginais.filter((id) => !metaIdsRestantes.has(id));

      await Promise.all([
        ...vinculoForm.plataformas.flatMap((p) => {
          const metasDaPlataforma = vinculoForm.metas[p]?.length ? vinculoForm.metas[p] : [metaVazia()];
          return metasDaPlataforma.map((meta) =>
            upsertMetaPlataforma(vinculoId, p, {
              quantidadeContratada: Number(meta.quantidadeContratada) || 0,
              modeloCompra: meta.modeloCompra,
              dataInicio: meta.periodoProprio ? meta.dataInicio : null,
              dataFim: meta.periodoProprio ? meta.dataFim : null,
            })
          );
        }),
        ...metaIdsParaRemover.map((id) => deleteMetaPlataforma(id)),
      ]);
      setVinculoForm(null);
      setMetaIdsOriginais([]);
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao vincular");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemoverVinculo() {
    await deleteCampanhaVeiculo(removendoVinculo.vinculoId);
    setRemovendoVinculo(null);
    onChanged();
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      {/* Header campanha */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--bg)", gap: 10 }}>
        {editandoNome ? (
          <form onSubmit={handleSalvarNome} style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={nomeEditado}
              onChange={(e) => setNomeEditado(e.target.value)}
              autoFocus
              required
              style={{ flex: "1 1 180px", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
            />
            <SimpleDateRangeFields
              start={dataInicioEditada}
              end={dataFimEditada}
              onChange={(s, e) => { setDataInicioEditada(s); setDataFimEditada(e); }}
            />
            <button type="submit" disabled={saving} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditandoNome(false);
                setNomeEditado(campanha.nome);
                setDataInicioEditada(campanha.data_inicio?.slice(0, 10) || "");
                setDataFimEditada(campanha.data_fim?.slice(0, 10) || "");
              }}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={campanha.nome}>
              {campanha.nome}
            </strong>
            <div style={{ flexShrink: 0 }}>
              <CampaignStatusDropdown value={campanha.status} onChange={onChangeStatus} />
            </div>
            {(campanha.data_inicio || campanha.data_fim) && (
              <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", flexShrink: 0 }}>
                Período: {campanha.data_inicio?.slice(0, 10).split("-").reverse().join("/") || "?"}
                {" – "}
                {campanha.data_fim?.slice(0, 10).split("-").reverse().join("/") || "?"}
              </span>
            )}
          </div>
        )}

        {!editandoNome && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setEditandoNome(true)}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
            >
              Editar
            </button>
            {vehiclesDisponiveis.length > 0 && (
              <button
                onClick={() => (vinculoForm ? setVinculoForm(null) : abrirNovoVinculo())}
                style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {vinculoForm && !vinculoForm.vinculoId ? "Cancelar" : "+ Veículo"}
              </button>
            )}
            <button
              onClick={onDelete}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: "pointer" }}
              title="Excluir campanha"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {/* Formulário de vínculo (criar ou editar) */}
      {vinculoForm && (
        <form onSubmit={handleVincular} style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Veículo (empresa)</label>
            {vinculoForm.vinculoId ? (
              <p style={{ margin: "4px 0 0", fontWeight: 600, fontSize: 14 }}>{vehicleSelecionado?.nome}</p>
            ) : (
              <SearchSelect
                value={vehicleSelecionado?.nome || ""}
                onChange={(nome) => {
                  const v = vehicles.find((x) => x.nome === nome);
                  setVinculoForm((f) => ({ ...f, vehicleId: v ? v.id : null, plataformas: [] }));
                }}
                options={vehiclesDisponiveis.map((v) => v.nome)}
                placeholder="Digite para buscar o veículo..."
              />
            )}
          </div>

          {vinculoForm.vehicleId && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Tipo de mídia nesta campanha
              </label>
              <MultiSelectDropdown
                value={TIPO_MIDIA_LABEL[vinculoForm.tipoMidia]}
                onChange={(v) => {
                  if (v) setVinculoForm((f) => ({ ...f, tipoMidia: TIPO_MIDIA_FROM_LABEL[v] || "online", plataformas: [] }));
                }}
                options={TIPO_MIDIA_OPTIONS}
                placeholder="Selecione"
              />
              <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                Define o que este veículo poderá ver nesta campanha, mesmo que opere outras mídias em geral.
              </p>
            </div>
          )}

          {vinculoForm.vehicleId && (() => {
            const opcoesPlataformas = plataformasParaTipo(vinculoForm.tipoMidia);
            // Garante que toda plataforma ja selecionada continua visivel/removivel no
            // dropdown, mesmo que o tipo de midia mudou e ela nao bateria mais no filtro.
            const opcoesComSelecionadas = [...new Set([...opcoesPlataformas, ...vinculoForm.plataformas])];
            return (
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Plataformas que este veículo trabalhará nesta campanha
                </label>
                <MultiSelectDropdown
                  multi
                  value={vinculoForm.plataformas}
                  onChange={(plataformas) =>
                    setVinculoForm((f) => {
                      const metas = {};
                      for (const p of plataformas) metas[p] = f.metas[p] || metaVazia();
                      return {
                        ...f,
                        plataformas,
                        // A tela nao expoe mais escolher plataformas por analise
                        // separadamente -- acompanha sempre todas as plataformas
                        // selecionadas para o veiculo.
                        plataformasAnaliseCriativo: plataformas,
                        metas,
                      };
                    })
                  }
                  options={opcoesComSelecionadas}
                  placeholder="Selecione as plataformas"
                />
              </div>
            );
          })()}

          {vinculoForm.vehicleId && vinculoForm.plataformas.length > 0 && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Meta contratada por plataforma
              </label>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 8px" }}>
                Usada para calcular Contratado x Entregue e Pacing na Lista de Veículos do Dashboard. Uma
                plataforma pode ter mais de uma meta ao mesmo tempo, uma para cada modelo de compra
                (ex: Meta Ads contratado em CPM e também em CPC).
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {vinculoForm.plataformas.map((p) => {
                  const metasDaPlataforma = vinculoForm.metas[p]?.length ? vinculoForm.metas[p] : [metaVazia()];

                  function updateMetaAt(index, patch) {
                    setVinculoForm((f) => {
                      const lista = f.metas[p]?.length ? f.metas[p] : [metaVazia()];
                      const novaLista = lista.map((m, i) => (i === index ? { ...m, ...patch } : m));
                      return { ...f, metas: { ...f.metas, [p]: novaLista } };
                    });
                  }

                  function addMeta() {
                    setVinculoForm((f) => {
                      const lista = f.metas[p]?.length ? f.metas[p] : [metaVazia()];
                      return { ...f, metas: { ...f.metas, [p]: [...lista, metaVazia()] } };
                    });
                  }

                  function removeMetaAt(index) {
                    setVinculoForm((f) => {
                      const lista = f.metas[p]?.length ? f.metas[p] : [metaVazia()];
                      const novaLista = lista.filter((_, i) => i !== index);
                      return { ...f, metas: { ...f.metas, [p]: novaLista.length ? novaLista : [metaVazia()] } };
                    });
                  }

                  // Tem meta de verdade se ja houver algum valor preenchido (edicao de vinculo
                  // existente) -- nesse caso o card comeca aberto, senao fica fechado ate o
                  // usuario clicar em "+ Definir meta" (nem todo veiculo/plataforma trabalha
                  // com meta de volume contratado, alguns sao so performance).
                  const temMetaPreenchida = metasDaPlataforma.some((m) => m.quantidadeContratada || m.metaId);
                  const aberta = metaAberta[p] ?? temMetaPreenchida;

                  return (
                    <div key={p} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: aberta ? 6 : 0 }}>
                        <strong style={{ fontSize: 12.5 }}>{p}</strong>
                        {aberta ? (
                          <button
                            type="button"
                            onClick={addMeta}
                            style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            + Adicionar modelo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setMetaAberta((prev) => ({ ...prev, [p]: true }))}
                            style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            + Definir meta
                          </button>
                        )}
                      </div>
                      {aberta && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {metasDaPlataforma.map((meta, index) => (
                          <div key={meta.metaId || index} style={{ paddingTop: index > 0 ? 10 : 0, borderTop: index > 0 ? "1px dashed var(--border)" : "none" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                              <div>
                                <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Quantidade contratada</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={meta.quantidadeContratada}
                                  onChange={(e) => updateMetaAt(index, { quantidadeContratada: e.target.value })}
                                  placeholder="Ex: 500000"
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12.5 }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Modelo de compra</label>
                                <MultiSelectDropdown
                                  compact
                                  value={meta.modeloCompra}
                                  onChange={(v) => v && updateMetaAt(index, { modeloCompra: v })}
                                  options={MODELO_COMPRA_OPTIONS}
                                  placeholder="Selecione"
                                />
                              </div>
                              {metasDaPlataforma.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeMetaAt(index)}
                                  title="Remover esta meta"
                                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: "pointer" }}
                                >
                                  <TrashIcon />
                                </button>
                              )}
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, marginTop: 8, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={meta.periodoProprio}
                                onChange={(e) => updateMetaAt(index, { periodoProprio: e.target.checked })}
                              />
                              Período próprio (diferente do período da campanha)
                            </label>
                            {meta.periodoProprio && (
                              <div style={{ marginTop: 6 }}>
                                <SimpleDateRangeFields
                                  start={meta.dataInicio}
                                  end={meta.dataFim}
                                  onChange={(s, e) => updateMetaAt(index, { dataInicio: s, dataFim: e })}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={saving || !vinculoForm.vehicleId || vinculoForm.plataformas.length === 0}
              style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: (!vinculoForm.vehicleId || vinculoForm.plataformas.length === 0) ? 0.5 : 1 }}
            >
              {saving ? "Salvando..." : vinculoForm.vinculoId ? "Salvar alterações" : "Vincular"}
            </button>
            <button
              type="button"
              onClick={() => setVinculoForm(null)}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Veículos vinculados */}
      {campanha.veiculos.length > 0 ? (
        <div style={{ padding: "8px 16px 12px" }}>
          {campanha.veiculos.map((v) => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--border)", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 13 }}>{v.nome}</strong>
                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                  ({TIPO_MIDIA_LABEL[v.tipoMidia] || "Online"})
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {v.plataformas.map((p) => {
                    const naAnalise = v.acessoAnaliseCriativo !== false && (v.plataformasAnaliseCriativo || []).includes(p);
                    return (
                      <span
                        key={p}
                        title={naAnalise ? "Aparece em Análise por Criativo" : "Não aparece em Análise por Criativo"}
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: naAnalise ? "var(--accent-soft)" : "var(--border)",
                          color: naAnalise ? "var(--accent)" : "var(--text-secondary)",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {p}
                      </span>
                    );
                  })}
                  {v.acessoAnaliseCriativo === false && (
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--danger-soft, #fdecec)", color: "var(--danger)", fontSize: 11, fontWeight: 600 }}>
                      Sem Análise por Criativo
                    </span>
                  )}
                  {v.acessoMatriz === false && (
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "var(--danger-soft, #fdecec)", color: "var(--danger)", fontSize: 11, fontWeight: 600 }}>
                      Sem Matriz de Conteúdo
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => abrirEdicaoVinculo(v)}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
                >
                  Editar
                </button>
                <button
                  onClick={() => setRemovendoVinculo({ vinculoId: v.id, nomeVeiculo: v.nome })}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}
                  title="Remover veículo da campanha"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !vinculoForm && (
          <p style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            Nenhum veículo vinculado. {vehicles.length === 0 ? "Cadastre veículos na aba Veículos primeiro." : "Clique em '+ Veículo' para vincular."}
          </p>
        )
      )}

      {removendoVinculo && (
        <ConfirmDialog
          title="Remover veículo"
          message={`Remover ${removendoVinculo.nomeVeiculo} desta campanha?`}
          onConfirm={handleConfirmRemoverVinculo}
          onCancel={() => setRemovendoVinculo(null)}
        />
      )}
    </div>
  );
}
