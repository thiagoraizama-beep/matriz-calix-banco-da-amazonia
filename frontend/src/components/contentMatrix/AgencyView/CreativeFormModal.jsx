import { useEffect, useRef, useState } from "react";
import { createMatrixCreative, createMatrixCreativeRascunho, updateMatrixCreative, deleteMatrixCreative, getCampanhas, getCreativeFiles, addCreativeFiles, removeCreativeFile, setCreativeFileAsCapa, reorderCreativeFiles } from "../../../api/client.js";
import SearchSelect from "../../layout/SearchSelect.jsx";
import MultiSearchSelect from "../../layout/MultiSearchSelect.jsx";
import SimpleDateRangeFields from "../../layout/SimpleDateRangeFields.jsx";

// Extrai uma mensagem SEMPRE em texto puro do erro de uma requisicao --
// nunca retorna o objeto de erro em si. Renderizar {error} direto no JSX
// quebra o React (error #31, "objects are not valid as a React child") se
// o valor nao for string -- acontecia com erro 413 (arquivo grande demais),
// onde a Vercel intercepta a requisicao antes do Express e devolve um corpo
// que nao e o { error: "..." } esperado.
function mensagemDeErro(err) {
  if (err?.response?.status === 413) {
    return "Arquivo grande demais para enviar. Tente um arquivo menor (o limite prático é bem menor que os 100MB permitidos pelo backend, por causa do servidor).";
  }
  const dado = err?.response?.data?.error;
  if (typeof dado === "string" && dado) return dado;
  return "Erro ao salvar criativo";
}

const TODOS_FORMATOS = [
  "Performance Max", "Search",
  "Feed", "Stories", "Reels", "Carrossel", "Coleção", "Instant Experience", "Messenger",
  "In-Feed", "TopView", "Brand Takeover", "Branded Hashtag Challenge", "Branded Effect", "Spark Ads",
  "In-Stream Pulável", "In-Stream Não Pulável", "Bumper Ad", "Discovery", "Shorts", "Masthead",
  "Kwai In-Feed", "Kwai TopView",
  "Audio Ad", "Podcast Ad", "Branded Playlist", "Display Audio",
  "Display", "Display Rich Media", "Interstitial", "Native", "Skin / Roadblock",
  "Banner", "Half Page", "Billboard", "Pop-Under",
  "DOOH", "OOH Outdoor", "OOH Mobiliário Urbano", "DOOH Metro", "DOOH Aeroporto",
  "VT 30s", "VT 15s", "VT 60s", "Spot Rádio 30s", "Spot Rádio 60s", "Merchandising",
  "Banner Home", "Sponsored Content", "Newsletter", "Push Notification",
  "Influencer Post", "Live", "Stories Interativo", "Link Patrocinado",
];

const TIPOS_COMPRA_OPTIONS = ["CPC", "CPM", "CPV", "CPE", "CPL", "CPT", "CPF", "CPA"];

// Abas do formulario, cada uma agrupando campos relacionados -- em vez de uma
// unica lista vertical de ~18 campos, quebra em blocos digestiveis. Cada campo
// obrigatorio mapeia pra uma aba (ver CAMPO_PARA_ABA abaixo), usado pra pular
// automaticamente pra aba certa quando a validacao falha num campo que esta
// numa aba diferente da atual.
const TABS = [
  { id: "basico", label: "Básico" },
  { id: "compra", label: "Compra e formato" },
  { id: "detalhes", label: "Detalhes técnicos" },
  { id: "notas", label: "Notas" },
];

const CAMPO_PARA_ABA = {
  formato: "basico", linkPostagem: "basico", file: "basico", campanha: "basico", veiculo: "basico", plataforma: "basico", nome: "basico",
  tipoCompra: "compra", periodo: "compra", observacoesFormularioNativo: "compra",
  adName: "detalhes",
};

function Field({ label, children, invalid }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: invalid ? "var(--danger)" : "var(--text-secondary)", display: "block", marginBottom: 5, fontWeight: invalid ? 700 : 500 }}>
        {label}
      </label>
      <div style={invalid ? { outline: "1px solid var(--danger)", borderRadius: 8 } : undefined}>
        {children}
      </div>
    </div>
  );
}

// Lista de campos de texto (ex: varios Titulos de um Search Ad) -- cada item
// tem seu proprio input, "+ Adicionar" cria um novo campo vazio no fim, "x"
// remove (nunca deixa a lista vazia, sempre sobra ao menos 1 input pronto).
function ListaCamposTexto({ valores, onChange, placeholder, multiline, inputStyle, textareaStyle }) {
  function setItem(i, valor) {
    const novos = [...valores];
    novos[i] = valor;
    onChange(novos);
  }
  function remover(i) {
    const novos = valores.filter((_, idx) => idx !== i);
    onChange(novos.length ? novos : [""]);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {valores.map((valor, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: multiline ? "flex-start" : "center" }}>
          {multiline ? (
            <textarea value={valor} onChange={(e) => setItem(i, e.target.value)} rows={2} style={{ ...textareaStyle, flex: 1 }} placeholder={placeholder} />
          ) : (
            <input value={valor} onChange={(e) => setItem(i, e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder={placeholder} />
          )}
          {valores.length > 1 && (
            <button
              type="button"
              onClick={() => remover(i)}
              title="Remover"
              style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...valores, ""])}
        style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
      >
        + Adicionar
      </button>
    </div>
  );
}

export default function CreativeFormModal({ creative, onClose, onSaved }) {
  const isEdit = Boolean(creative?.id) && !creative?._duplicate;
  const title = creative?._duplicate ? "Duplicar criativo" : isEdit ? "Editar criativo" : "Novo criativo";

  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" };
  const textareaStyle = { ...inputStyle, fontFamily: "inherit", resize: "vertical" };

  const [nome, setNome] = useState(creative?.nome || "");
  const [adName, setAdName] = useState((creative?.ad_name || "").replace(/\s+/g, " ").trim());
  const [campaignName, setCampaignName] = useState(creative?.campaign_name || "");
  const [campanha, setCampanha] = useState(creative?.campanha || "");
  const [veiculo, setVeiculo] = useState(creative?.veiculo || "");
  const [conjunto, setConjunto] = useState(creative?.conjunto || "");
  // Formato e selecao unica pra QUALQUER formato, EXCETO Performance Max --
  // PMax combina Search (texto) + Display/YouTube (midia) no mesmo criativo,
  // entao ele sozinho permite somar outros formatos junto. Qualquer outro
  // formato marcado sem PMax continua excludente (marcar um substitui o
  // anterior, como era antes da mudanca pra multi-select).
  const [formato, setFormato] = useState(creative?.formato || []);
  function handleFormatoChange(novos) {
    if (novos.includes("Performance Max")) {
      setFormato(novos);
      return;
    }
    // Sem PMax no array novo: mantem so o ultimo valor adicionado/restante
    // (novos tem no maximo 1 a mais que formato, ja que MultiSearchSelect
    // sempre adiciona ou remove 1 item por vez).
    setFormato(novos.length ? [novos[novos.length - 1]] : []);
  }
  const [plataforma, setPlataforma] = useState(creative?.plataforma || "");
  const [posicionamento, setPosicionamento] = useState(creative?.posicionamento || "");
  const [urlDestino, setUrlDestino] = useState(creative?.url_destino || "");
  const [impulsionado, setImpulsionado] = useState(creative?.impulsionado !== false);
  const [linkPostagem, setLinkPostagem] = useState(creative?.link_postagem || "");
  const [ehPerformance, setEhPerformance] = useState(creative?.eh_performance === true);
  // Guardado em centavos (inteiro) para a mascara de moeda preencher da direita
  // para a esquerda, tipo campo de valor de app bancario (digita "1000" -> "R$ 10,00").
  const [orcamentoCentavos, setOrcamentoCentavos] = useState(
    creative?.orcamento_projetado ? Math.round(Number(creative.orcamento_projetado) * 100) : 0
  );
  const [segmentacao, setSegmentacao] = useState(creative?.segmentacao || "");
  const [titulo, setTitulo] = useState(creative?.titulo || "");
  const [tipoCompra, setTipoCompra] = useState(creative?.tipos_compra?.[0] || "");
  const [periodoInicio, setPeriodoInicio] = useState(creative?.periodo_inicio?.slice(0, 10) || "");
  const [periodoFim, setPeriodoFim] = useState(creative?.periodo_fim?.slice(0, 10) || "");
  const [descricao, setDescricao] = useState(creative?.descricao || "");
  const [observacoes, setObservacoes] = useState(creative?.observacoes || "");
  const [formularioNativo, setFormularioNativo] = useState(creative?.formulario_nativo === true);
  const [observacoesFormularioNativo, setObservacoesFormularioNativo] = useState(creative?.observacoes_formulario_nativo || "");
  // titulo/tituloLongo/texto sao listas (Google Search Responsive Ads aceita
  // varias variacoes de cada) -- normaliza string antiga (formato anterior a
  // essa mudanca) pra array de 1 item, sempre com pelo menos 1 campo vazio
  // pronto pra digitar.
  function normalizarListaSearch(valor) {
    if (Array.isArray(valor)) return valor.length ? valor : [""];
    if (typeof valor === "string" && valor) return [valor];
    return [""];
  }
  const [searchCampos, setSearchCampos] = useState({
    titulo: normalizarListaSearch(creative?.search_campos?.titulo),
    tituloLongo: normalizarListaSearch(creative?.search_campos?.tituloLongo),
    texto: normalizarListaSearch(creative?.search_campos?.texto),
    palavrasChave: creative?.search_campos?.palavrasChave || "",
  });
  // Upload unico, multiplo -- um criativo pode ter varios arquivos (ex:
  // varios tamanhos de banner Display), um deles marcado como capa/preview
  // do card. Criacao: capaIndex escolhe qual dos arquivosNovos vira o
  // arquivo principal (creatives.cloudinary_*) ao salvar, os demais entram
  // como extras (creative_files). Edicao: capaAtual espelha o arquivo
  // principal ja salvo (creative.cloudinary_url/tipo_midia) -- clicar numa
  // miniatura ja salva troca a capa de verdade via API (setCreativeFileAsCapa).
  const [arquivosExistentes, setArquivosExistentes] = useState([]);
  const [arquivosNovos, setArquivosNovos] = useState([]);
  const [capaIndex, setCapaIndex] = useState(0);
  const [capaAtual, setCapaAtual] = useState(
    creative?.cloudinary_url ? { cloudinary_url: creative.cloudinary_url, tipo_midia: creative.tipo_midia } : null
  );
  const [trocandoCapa, setTrocandoCapa] = useState(false);
  const [arrastandoId, setArrastandoId] = useState(null);
  const [enviandoArquivosExtras, setEnviandoArquivosExtras] = useState(false);
  const arquivoInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [campoInvalido, setCampoInvalido] = useState(null);

  const [campanhaOptions, setCampanhaOptions] = useState([]);
  const [veiculoOptions, setVeiculoOptions] = useState([]);
  const [campanhaData, setCampanhaData] = useState([]);
  const [plataformasVeiculo, setPlataformasVeiculo] = useState([]);
  const [campanhaVeiculoId, setCampanhaVeiculoId] = useState(creative?.campanha_veiculo_id || null);
  const [confirmandoFechar, setConfirmandoFechar] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("basico");

  useEffect(() => {
    getCampanhas()
      .then((list) => {
        setCampanhaData(list);
        setCampanhaOptions(list.map((c) => c.nome));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getCreativeFiles(creative.id).then(setArquivosExistentes).catch(console.error);
  }, [isEdit, creative?.id]);

  function handleArquivosChange(e) {
    const novos = Array.from(e.target.files || []);
    setArquivosNovos((prev) => [...prev, ...novos]);
    e.target.value = "";
  }

  function removerArquivoNovo(index) {
    setArquivosNovos((prev) => prev.filter((_, i) => i !== index));
    setCapaIndex((prev) => {
      if (index < prev) return prev - 1;
      if (index === prev) return 0;
      return prev;
    });
  }

  // Arquivo ja salvo -- remove direto via API (nao espera o "Salvar" do form).
  async function removerArquivoExistente(fileId) {
    try {
      await removeCreativeFile(creative.id, fileId);
      setArquivosExistentes((prev) => prev.filter((a) => a.id !== fileId));
    } catch (err) {
      console.error(err);
    }
  }

  // Arrastar e soltar entre arquivos extras ja salvos -- so reordena os
  // EXTRAS entre si (a capa e sempre o creative.cloudinary_url, escolhida
  // via trocarCapa). A nova ordem persiste na hora e vale tanto pro
  // carrossel (MediaCarousel.jsx) quanto pra numeracao do zip.
  async function reordenarArquivoExistente(fileIdArrastado, fileIdAlvo) {
    if (fileIdArrastado === fileIdAlvo) return;
    const indiceOrigem = arquivosExistentes.findIndex((a) => a.id === fileIdArrastado);
    const indiceDestino = arquivosExistentes.findIndex((a) => a.id === fileIdAlvo);
    if (indiceOrigem === -1 || indiceDestino === -1) return;

    const reordenados = [...arquivosExistentes];
    const [movido] = reordenados.splice(indiceOrigem, 1);
    reordenados.splice(indiceDestino, 0, movido);
    setArquivosExistentes(reordenados);

    try {
      await reorderCreativeFiles(creative.id, reordenados.map((a) => a.id));
    } catch (err) {
      console.error(err);
      setArquivosExistentes(arquivosExistentes);
    }
  }

  // Troca a capa entre arquivos ja salvos -- o extra escolhido vira o
  // principal de verdade (via API), o principal atual desce pra extra.
  async function trocarCapa(fileId) {
    setTrocandoCapa(true);
    try {
      const atualizado = await setCreativeFileAsCapa(creative.id, fileId);
      setCapaAtual({ cloudinary_url: atualizado.cloudinary_url, tipo_midia: atualizado.tipo_midia });
      const arquivos = await getCreativeFiles(creative.id);
      setArquivosExistentes(arquivos);
    } catch (err) {
      console.error(err);
    } finally {
      setTrocandoCapa(false);
    }
  }

  // Envia os arquivos que NAO viraram capa como extras -- so pode rodar
  // depois que o criativo principal ja existe (precisa de um id). Em
  // criacao, o arquivo da capa (capaIndex) ja foi enviado como principal
  // dentro de montarFormData, entao aqui so sobram os demais.
  async function enviarArquivosExtras(creativeId) {
    const extras = isEdit ? arquivosNovos : arquivosNovos.filter((_, i) => i !== capaIndex);
    if (extras.length === 0) return;
    setEnviandoArquivosExtras(true);
    try {
      await addCreativeFiles(creativeId, extras);
      setArquivosNovos([]);
    } catch (err) {
      console.error(err);
    } finally {
      setEnviandoArquivosExtras(false);
    }
  }

  // Deriva veiculoOptions/plataformasVeiculo/campanhaVeiculoId a partir de campanhaData+campanha+veiculo
  // sempre de forma idempotente (recalcula do zero, nao depende de "rodou uma vez") -- robusto contra
  // remontagens do StrictMode em dev, que quebravam a logica antiga baseada em refs consumidos uma unica vez.
  useEffect(() => {
    if (campanhaData.length === 0 || !campanha) {
      setVeiculoOptions([]);
      return;
    }
    const found = campanhaData.find((c) => c.nome === campanha);
    setVeiculoOptions(found?.veiculos?.length ? found.veiculos.map((v) => v.nome) : []);
  }, [campanhaData, campanha]);

  useEffect(() => {
    if (campanhaData.length === 0 || !campanha || !veiculo) {
      setPlataformasVeiculo([]);
      setCampanhaVeiculoId(null);
      return;
    }
    const found = campanhaData.find((c) => c.nome === campanha);
    const veiculoData = found?.veiculos?.find((v) => v.nome === veiculo);
    setPlataformasVeiculo(veiculoData?.plataformas || []);
    setCampanhaVeiculoId(veiculoData?.id || null);
  }, [campanhaData, campanha, veiculo]);

  // Handlers chamados pelo usuario ao trocar campanha/veiculo manualmente -- limpam os
  // campos dependentes (plataforma nao faz mais sentido se o veiculo mudou, por ex).
  function handleCampanhaChange(v) {
    setCampanha(v || "");
    setVeiculo("");
    setPlataforma("");
  }

  function handleVeiculoChange(v) {
    setVeiculo(v || "");
    setPlataforma("");
  }



  const MENSAGEM_CAMPO_PENDENTE = "Preencha os campos pendentes";

  // Campos de texto do Search aparecem sempre que o criativo tiver algo que
  // usa esse tipo de conteudo: Search puro, Performance Max (combina Search +
  // midia) ou Display do Google (Display generico so entra aqui quando a
  // Plataforma cadastrada e do Google -- outras redes com Display, tipo Meta,
  // nao usam titulo/descricao no formato do Google Ads).
  const ehDisplayGoogle = formato.includes("Display") && plataforma.toLowerCase().includes("google");
  const ehSearch = formato.includes("Search") || formato.includes("Performance Max") || ehDisplayGoogle;
  // Palavras-chave e exclusivo de Search/PMax (busca) -- Display nao tem
  // busca por palavra-chave, so segmentacao por publico/interesse.
  const temPalavrasChave = formato.includes("Search") || formato.includes("Performance Max");
  // O upload de arquivo so fica isento quando Search e o UNICO formato
  // marcado (PMax combinando Search + Display, por ex, continua exigindo
  // arquivo pelo outro formato).
  const ehSoSearch = formato.length === 1 && formato[0] === "Search";

  function validarCamposObrigatorios() {
    if (!formato.length) return { campo: "formato", mensagem: MENSAGEM_CAMPO_PENDENTE };
    // Google Search e so texto -- nao exige arquivo nem link de postagem,
    // mas so quando Search e o unico formato marcado.
    if (!ehSoSearch) {
      if (impulsionado) {
        if (!linkPostagem.trim()) return { campo: "linkPostagem", mensagem: MENSAGEM_CAMPO_PENDENTE };
      } else if (!isEdit && arquivosNovos.length === 0 && !creative?.cloudinary_url) {
        return { campo: "file", mensagem: MENSAGEM_CAMPO_PENDENTE };
      }
    }
    if (!campanha) return { campo: "campanha", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!veiculo) return { campo: "veiculo", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!plataforma) return { campo: "plataforma", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!tipoCompra) return { campo: "tipoCompra", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!nome.trim()) return { campo: "nome", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (!periodoInicio || !periodoFim) return { campo: "periodo", mensagem: MENSAGEM_CAMPO_PENDENTE };
    if (periodoInicio > periodoFim) return { campo: "periodo", mensagem: "A data inicial não pode ser depois da data final" };
    // CPL com formulario nativo exige descrever o formulario, ja que nao ha
    // URL/LP externa pra documentar o que foi configurado na plataforma.
    if (tipoCompra === "CPL" && formularioNativo && !observacoesFormularioNativo.trim()) {
      return { campo: "observacoesFormularioNativo", mensagem: "Descreva o formulário nativo" };
    }
    return null;
  }

  // Monta o FormData comum a criacao/edicao/rascunho -- evita repetir os mesmos
  // ~20 fd.append em tres lugares. isRascunho pula a normalizacao de URL (nao
  // faz sentido "corrigir" um campo que o usuario pode nem ter preenchido ainda).
  function montarFormData({ incluirMidiaExistente }) {
    const fd = new FormData();
    // So em criacao o arquivo escolhido como capa vira o arquivo principal
    // (creatives.cloudinary_*) -- em edicao a capa ja salva nao muda por
    // aqui, os arquivosNovos entram todos como extras (ver enviarArquivosExtras).
    const arquivoCapa = !isEdit ? arquivosNovos[capaIndex] : null;
    if (arquivoCapa) fd.append("file", arquivoCapa);
    if (!arquivoCapa && incluirMidiaExistente && creative?.cloudinary_url) {
      fd.append("cloudinaryUrl", creative.cloudinary_url);
      fd.append("cloudinaryPublicId", creative.cloudinary_public_id);
      fd.append("tipoMidia", creative.tipo_midia);
    }
    const urlDestinoNormalizada = urlDestino.trim() && !/^https?:\/\//i.test(urlDestino.trim())
      ? `https://${urlDestino.trim()}`
      : urlDestino.trim();
    fd.append("nome", nome);
    fd.append("adName", adName);
    fd.append("campaignName", campaignName);
    fd.append("campanha", campanha);
    fd.append("veiculo", veiculo);
    fd.append("plataforma", plataforma);
    fd.append("conjunto", conjunto);
    fd.append("formato", JSON.stringify(formato));
    fd.append("posicionamento", posicionamento);
    fd.append("urlDestino", urlDestinoNormalizada);
    fd.append("impulsionado", String(impulsionado));
    fd.append("linkPostagem", linkPostagem);
    fd.append("ehPerformance", String(ehPerformance));
    if (ehPerformance) fd.append("orcamentoProjetado", String(orcamentoCentavos / 100));
    fd.append("segmentacao", segmentacao);
    fd.append("titulo", titulo);
    fd.append("tiposCompra", JSON.stringify(tipoCompra ? [tipoCompra] : []));
    if (campanhaVeiculoId) fd.append("campanhaVeiculoId", campanhaVeiculoId);
    if (periodoInicio) fd.append("periodoInicio", periodoInicio);
    if (periodoFim) fd.append("periodoFim", periodoFim);
    fd.append("descricao", descricao);
    fd.append("observacoes", observacoes);
    fd.append("formularioNativo", String(tipoCompra === "CPL" && formularioNativo));
    fd.append("observacoesFormularioNativo", tipoCompra === "CPL" ? observacoesFormularioNativo : "");
    const searchCamposLimpos = ehSearch
      ? {
          titulo: searchCampos.titulo.map((v) => v.trim()).filter(Boolean),
          tituloLongo: searchCampos.tituloLongo.map((v) => v.trim()).filter(Boolean),
          texto: searchCampos.texto.map((v) => v.trim()).filter(Boolean),
          palavrasChave: searchCampos.palavrasChave,
        }
      : null;
    fd.append("searchCampos", JSON.stringify(searchCamposLimpos));
    return fd;
  }

  // Ha alguma alteracao que valha perguntar "salvar como rascunho?" ao fechar --
  // criativo novo com qualquer campo preenchido, ou edicao de um rascunho
  // existente com qualquer mudanca. Nao dispara em edicao de um criativo ja
  // "de verdade" (fechar sem salvar ali so descarta a edicao, como sempre foi).
  const ehRascunhoOuNovo = !isEdit || creative?.status === "Rascunho";
  const temAlgumCampoPreenchido = Boolean(
    arquivosNovos.length > 0 || nome.trim() || adName.trim() || campanha || veiculo || plataforma ||
    conjunto || formato.length > 0 || urlDestino.trim() || linkPostagem.trim() || segmentacao.trim() ||
    titulo.trim() || tipoCompra || periodoInicio || periodoFim || descricao.trim() || observacoes.trim()
  );

  async function handleSubmit(e) {
    e?.preventDefault();
    setError("");
    setCampoInvalido(null);
    const erroValidacao = validarCamposObrigatorios();
    if (erroValidacao) {
      setError(erroValidacao.mensagem);
      setCampoInvalido(erroValidacao.campo);
      setAbaAtiva(CAMPO_PARA_ABA[erroValidacao.campo] || "basico");
      return;
    }
    setSaving(true);
    try {
      let salvo;
      if (isEdit) {
        const fd = montarFormData({ incluirMidiaExistente: false });
        if (creative.status === "Rascunho") fd.append("publicarRascunho", "true");
        salvo = await updateMatrixCreative(creative.id, fd);
      } else {
        const fd = montarFormData({ incluirMidiaExistente: true });
        salvo = await createMatrixCreative(fd);
      }
      await enviarArquivosExtras(salvo.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(mensagemDeErro(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSalvarRascunho() {
    setSaving(true);
    try {
      const fd = montarFormData({ incluirMidiaExistente: true });
      if (isEdit) {
        await updateMatrixCreative(creative.id, fd);
      } else {
        await createMatrixCreativeRascunho(fd);
      }
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      onClose();
    }
  }

  // Avanca pro proximo passo do wizard, mas so se nao houver campo obrigatorio
  // pendente ATE o passo atual (inclusive) -- um erro que pertence a um passo
  // futuro nao bloqueia o avanco, ja que o usuario ainda vai chegar la.
  function handleProximo() {
    const erroValidacao = validarCamposObrigatorios();
    const indiceAtual = TABS.findIndex((t) => t.id === abaAtiva);
    const indiceErro = erroValidacao ? TABS.findIndex((t) => t.id === (CAMPO_PARA_ABA[erroValidacao.campo] || "basico")) : -1;
    if (erroValidacao && indiceErro <= indiceAtual) {
      setError(erroValidacao.mensagem);
      setCampoInvalido(erroValidacao.campo);
      return;
    }
    setError("");
    setCampoInvalido(null);
    setAbaAtiva(TABS[indiceAtual + 1].id);
  }

  function handleVoltar() {
    const indiceAtual = TABS.findIndex((t) => t.id === abaAtiva);
    if (indiceAtual > 0) setAbaAtiva(TABS[indiceAtual - 1].id);
  }

  function handleFechar() {
    if (ehRascunhoOuNovo && temAlgumCampoPreenchido) {
      setConfirmandoFechar(true);
      return;
    }
    onClose();
  }

  // "Descartar": se ja existe um rascunho salvo no banco (reabriu um pra editar
  // e decidiu jogar fora), exclui de verdade -- limpa Cloudinary tambem, mesma
  // rota usada pra exclusao normal. Se e um criativo novo que nunca foi salvo
  // (nem como rascunho), so fecha -- nao ha nada no banco pra excluir.
  async function handleDescartar() {
    if (isEdit && creative?.status === "Rascunho") {
      try {
        await deleteMatrixCreative(creative.id);
        onSaved();
      } catch (err) {
        console.error(err);
      }
    }
    setConfirmandoFechar(false);
    onClose();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
    >
      <div
        style={{
          width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto",
          display: "flex", flexDirection: "column",
          background: "var(--card-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(10,16,32,0.35)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" }}>
          <strong style={{ fontSize: 17, fontWeight: 700 }}>{title}</strong>
          <button
            type="button"
            onClick={handleFechar}
            aria-label="Fechar"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Indicador de progresso (wizard) -- passos numerados, ligados por uma
            linha, sempre clicaveis em qualquer direcao (ir e voltar livremente).
            A validacao dos campos obrigatorios so acontece no Salvar final, nao
            mais bloqueando o avanco entre passos. */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 24px 0" }}>
          {TABS.map((t, i) => {
            const indiceAtivo = TABS.findIndex((x) => x.id === abaAtiva);
            const temErroNestaAba = campoInvalido && CAMPO_PARA_ABA[campoInvalido] === t.id;
            const concluido = i < indiceAtivo;
            const ativo = t.id === abaAtiva;
            const podeClicar = true;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", flex: i < TABS.length - 1 ? 1 : "0 0 auto" }}>
                <button
                  type="button"
                  onClick={() => podeClicar && setAbaAtiva(t.id)}
                  disabled={!podeClicar}
                  title={t.label}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    width: 28, height: 28, borderRadius: "50%", fontSize: 12, fontWeight: 700,
                    border: `2px solid ${temErroNestaAba ? "var(--danger)" : ativo || concluido ? "var(--accent)" : "var(--border)"}`,
                    background: temErroNestaAba ? "rgba(220,38,38,0.1)" : concluido ? "var(--accent)" : ativo ? "var(--accent-soft)" : "var(--card-bg)",
                    color: temErroNestaAba ? "var(--danger)" : concluido ? "#fff" : ativo ? "var(--accent)" : "var(--text-secondary)",
                    cursor: podeClicar ? "pointer" : "default",
                  }}
                >
                  {concluido && !temErroNestaAba ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>
                {i < TABS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < indiceAtivo ? "var(--accent)" : "var(--border)", marginLeft: 4 }} />
                )}
              </div>
            );
          })}
        </div>
        <p style={{ margin: "10px 24px 0", fontSize: 14, fontWeight: 700 }}>
          {TABS.find((t) => t.id === abaAtiva)?.label}
        </p>
        <div style={{ height: 1, background: "var(--border)", margin: "12px 24px 0" }} />

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          {abaAtiva === "basico" && (
            <>
              {/* Formato vem primeiro na aba, antes do arquivo -- multi-selecao (ex:
                  Performance Max = Search + Display juntos). Marcar "Search" soma os
                  campos de texto abaixo; o upload de arquivo so some quando Search
                  for o UNICO formato marcado (senao continua exigido pelos outros). */}
              <Field label="Formato *" invalid={campoInvalido === "formato"}>
                <MultiSearchSelect
                  value={formato}
                  onChange={handleFormatoChange}
                  options={TODOS_FORMATOS}
                  placeholder="Buscar formato: Search, Stories, Reels..."
                />
              </Field>

              {ehSearch && (
                <>
                  <Field label="Títulos">
                    <ListaCamposTexto
                      valores={searchCampos.titulo}
                      onChange={(novos) => setSearchCampos((s) => ({ ...s, titulo: novos }))}
                      inputStyle={inputStyle}
                      textareaStyle={textareaStyle}
                    />
                  </Field>
                  <Field label="Títulos longos">
                    <ListaCamposTexto
                      valores={searchCampos.tituloLongo}
                      onChange={(novos) => setSearchCampos((s) => ({ ...s, tituloLongo: novos }))}
                      inputStyle={inputStyle}
                      textareaStyle={textareaStyle}
                    />
                  </Field>
                  <Field label="Descrições">
                    <ListaCamposTexto
                      valores={searchCampos.texto}
                      onChange={(novos) => setSearchCampos((s) => ({ ...s, texto: novos }))}
                      multiline
                      inputStyle={inputStyle}
                      textareaStyle={textareaStyle}
                    />
                  </Field>
                  {temPalavrasChave && (
                    <Field label="Palavras-chave">
                      <textarea
                        value={searchCampos.palavrasChave}
                        onChange={(e) => setSearchCampos((s) => ({ ...s, palavrasChave: e.target.value }))}
                        rows={2} style={textareaStyle}
                        placeholder="Separe por vírgula ou quebra de linha"
                      />
                    </Field>
                  )}
                </>
              )}

              {!ehSoSearch && (
                <>
                  {/* Impulsionado / Darkpost -- decide o que aparece no campo seguinte:
                      Impulsionado pede o link do post ja publicado, Dark Post exige upload
                      de arquivo (nao existe como post organico). */}
                  <Field label="Tipo de publicação">
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ label: "Impulsionado", val: true }, { label: "Dark Post", val: false }].map(({ label, val }) => {
                        const sel = impulsionado === val;
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setImpulsionado(val)}
                            style={{
                              flex: 1, padding: "9px 12px", borderRadius: 10, border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                              background: sel ? "var(--accent-soft)" : "transparent", color: sel ? "var(--accent)" : "var(--text-secondary)",
                              fontSize: 13, fontWeight: sel ? 700 : 500, cursor: "pointer",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  {impulsionado && (
                    <Field label="Link da postagem *" invalid={campoInvalido === "linkPostagem"}>
                      <input
                        value={linkPostagem}
                        onChange={(e) => setLinkPostagem(e.target.value)}
                        type="text"
                        placeholder="https://..."
                        style={inputStyle}
                      />
                    </Field>
                  )}

                  {/* Arquivo(s) -- obrigatorio so para Dark Post (nao existe post organico
                      pra linkar); em Impulsionado fica opcional, so para ter uma imagem de
                      preview do card na Matriz. Upload unico e multiplo: pode escolher
                      varios arquivos de uma vez (ex: tamanhos diferentes do mesmo banner
                      Display) -- em criacao, clique numa miniatura pra marcar qual vira a
                      capa/preview do card; em edicao, clicar numa miniatura ja salva troca a
                      capa de verdade (setCreativeFileAsCapa) -- o principal atual desce pra
                      arquivo adicional no lugar dela. */}
                  <Field
                    label={impulsionado ? "Arquivo(s) (opcional, para preview)" : isEdit ? "Arquivo(s)" : "Arquivo(s) *"}
                    invalid={campoInvalido === "file"}
                  >
                    {(isEdit && capaAtual || arquivosExistentes.length > 0 || arquivosNovos.length > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                        {isEdit && capaAtual && (
                          <div style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", background: "var(--bg)", border: "2px solid var(--accent)" }}>
                            {capaAtual.tipo_midia === "video" ? (
                              <video src={capaAtual.cloudinary_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <img src={capaAtual.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                            <span style={{ position: "absolute", bottom: 2, left: 2, right: 2, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(20,33,61,0.75)", borderRadius: 4, padding: "1px 0" }}>
                              Capa
                            </span>
                          </div>
                        )}
                        {arquivosExistentes.map((a) => (
                          <div
                            key={a.id}
                            draggable={!trocandoCapa}
                            onDragStart={(e) => { e.stopPropagation(); setArrastandoId(a.id); }}
                            onDragEnd={() => setArrastandoId(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (arrastandoId) reordenarArquivoExistente(arrastandoId, a.id); }}
                            title="Arraste para reordenar"
                            style={{
                              position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", background: "var(--bg)",
                              cursor: trocandoCapa ? "default" : "grab",
                              opacity: trocandoCapa ? 0.6 : (arrastandoId === a.id ? 0.55 : 1),
                              boxShadow: arrastandoId === a.id ? "0 6px 16px rgba(20,33,61,0.28)" : "none",
                              transform: arrastandoId === a.id ? "scale(0.96)" : "scale(1)",
                              transition: "opacity 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
                            }}
                          >
                            {a.tipo_midia === "video" ? (
                              <video src={a.cloudinary_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <img src={a.cloudinary_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (!trocandoCapa) trocarCapa(a.id); }}
                              title="Tornar capa"
                              style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(20,33,61,0.75)", color: "#fff", cursor: trocandoCapa ? "default" : "pointer", fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              ★
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removerArquivoExistente(a.id); }}
                              title="Remover"
                              style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(20,33,61,0.75)", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: 1 }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {arquivosNovos.map((f, i) => {
                          // So faz sentido escolher capa em criacao -- em edicao a capa ja
                          // esta definida (creative.cloudinary_url), todo novo e extra.
                          const ehCapa = !isEdit && i === capaIndex;
                          return (
                            <div
                              key={i}
                              onClick={() => !isEdit && setCapaIndex(i)}
                              style={{
                                position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden",
                                background: "var(--bg)", cursor: !isEdit ? "pointer" : "default",
                                border: ehCapa ? "2px solid var(--accent)" : "2px solid transparent",
                              }}
                            >
                              {f.type?.startsWith("video") ? (
                                <video src={URL.createObjectURL(f)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              )}
                              {ehCapa && (
                                <span style={{ position: "absolute", bottom: 2, left: 2, right: 2, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(20,33,61,0.75)", borderRadius: 4, padding: "1px 0" }}>
                                  Capa
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removerArquivoNovo(i); }}
                                title="Remover"
                                style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(20,33,61,0.75)", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!isEdit && arquivosNovos.length > 1 && (
                      <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "var(--text-secondary)" }}>
                        Clique numa miniatura pra escolher qual vira a capa do card.
                      </p>
                    )}
                    {isEdit && arquivosExistentes.length > 0 && (
                      <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "var(--text-secondary)" }}>
                        {trocandoCapa ? "Trocando capa..." : "Clique na estrela ★ para tornar a capa do card. Arraste para reordenar."}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => arquivoInputRef.current?.click()}
                      disabled={enviandoArquivosExtras}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: enviandoArquivosExtras ? "default" : "pointer" }}
                    >
                      {enviandoArquivosExtras ? "Enviando..." : "Escolher arquivo(s)"}
                    </button>
                    <input
                      ref={arquivoInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleArquivosChange}
                      style={{ display: "none" }}
                    />
                  </Field>
                </>
              )}

              {/* Campanha → carrega veículos */}
              <Field label="Campanha *" invalid={campoInvalido === "campanha"}>
                <SearchSelect
                  value={campanha}
                  onChange={handleCampanhaChange}
                  options={campanhaOptions}
                  placeholder="Selecione a campanha..."
                  allowFreeText
                />
              </Field>

              {/* Veículo — carregado a partir da campanha */}
              <Field label="Veículo *" invalid={campoInvalido === "veiculo"}>
                <SearchSelect
                  value={veiculo}
                  onChange={handleVeiculoChange}
                  options={veiculoOptions}
                  placeholder={campanha ? "Selecione o veículo..." : "Selecione a campanha primeiro"}
                  allowFreeText
                />
                {plataformasVeiculo.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 11.5, color: campoInvalido === "plataforma" ? "var(--danger)" : "var(--text-secondary)", display: "block", marginBottom: 6, fontWeight: campoInvalido === "plataforma" ? 700 : 500 }}>
                      Plataforma *
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {plataformasVeiculo.map((p) => {
                        const sel = plataforma === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPlataforma(sel ? "" : p)}
                            style={{
                              padding: "5px 13px",
                              borderRadius: 999,
                              border: "1px solid",
                              borderColor: sel ? "var(--accent)" : campoInvalido === "plataforma" ? "var(--danger)" : "var(--border)",
                              background: sel ? "var(--accent)" : "transparent",
                              color: sel ? "#fff" : "var(--text-secondary)",
                              fontSize: 12,
                              fontWeight: sel ? 700 : 500,
                              cursor: "pointer",
                            }}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Field>

              {/* Nome do criativo */}
              <Field label="Nome do criativo *" invalid={campoInvalido === "nome"}>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required style={inputStyle} />
              </Field>
            </>
          )}

          {abaAtiva === "compra" && (
            <>
              {/* Tipo de compra — seleção única */}
              <Field label="Tipo de compra *" invalid={campoInvalido === "tipoCompra"}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TIPOS_COMPRA_OPTIONS.map((t) => {
                    const sel = tipoCompra === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoCompra(sel ? "" : t)}
                        style={{
                          padding: "5px 13px",
                          borderRadius: 999,
                          border: "1px solid",
                          borderColor: sel ? "var(--accent)" : campoInvalido === "tipoCompra" ? "var(--danger)" : "var(--border)",
                          background: sel ? "var(--accent)" : "transparent",
                          color: sel ? "#fff" : "var(--text-secondary)",
                          fontSize: 12,
                          fontWeight: sel ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Formulario nativo -- so faz sentido quando o tipo de compra e CPL. A
                  captura de lead pode acontecer dentro da propria plataforma (ex: Meta
                  Lead Ads, sem LP externa) ou via site/LP -- url_destino continua
                  disponivel independente dessa escolha. */}
              {tipoCompra === "CPL" && (
                <Field label="Formulário de captura">
                  <div style={{ display: "flex", gap: 8, marginBottom: formularioNativo ? 10 : 0 }}>
                    {[{ label: "Site/LP externa", val: false }, { label: "Nativo da plataforma", val: true }].map(({ label, val }) => {
                      const sel = formularioNativo === val;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setFormularioNativo(val)}
                          style={{
                            flex: 1, padding: "9px 12px", borderRadius: 10, border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                            background: sel ? "var(--accent-soft)" : "transparent", color: sel ? "var(--accent)" : "var(--text-secondary)",
                            fontSize: 13, fontWeight: sel ? 700 : 500, cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {formularioNativo && (
                    <Field label="Observações do formulário nativo *" invalid={campoInvalido === "observacoesFormularioNativo"}>
                      <textarea
                        value={observacoesFormularioNativo}
                        onChange={(e) => setObservacoesFormularioNativo(e.target.value)}
                        rows={3} style={textareaStyle}
                        placeholder="Descreva os campos coletados, ex: Nome / Telefone / Email"
                      />
                    </Field>
                  )}
                </Field>
              )}

              {/* Período */}
              <Field label="Período de veiculação *" invalid={campoInvalido === "periodo"}>
                <SimpleDateRangeFields
                  start={periodoInicio}
                  end={periodoFim}
                  onChange={(s, en) => { setPeriodoInicio(s); setPeriodoFim(en); }}
                />
              </Field>

              {/* Performance -- independente do tipo de publicacao (Impulsionado ou Dark
                  Post). Quando marcado, o card na Matriz mostra uma barra comparando o
                  orcamento projetado aqui com o investimento real vindo da planilha
                  (coluna Cost). */}
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input type="checkbox" checked={ehPerformance} onChange={(e) => setEhPerformance(e.target.checked)} />
                  Performance (acompanhar orçamento projetado x investido)
                </label>

                {ehPerformance && (
                  <Field label="Orçamento projetado">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={(orcamentoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      onChange={(e) => {
                        // So digitos contam -- cada digito novo "empurra" os centavos, exatamente
                        // como um campo de valor de app bancario.
                        const digitos = e.target.value.replace(/\D/g, "");
                        setOrcamentoCentavos(digitos ? Number(digitos) : 0);
                      }}
                      style={inputStyle}
                    />
                  </Field>
                )}
              </div>
            </>
          )}

          {abaAtiva === "detalhes" && (
            <>
              {/* Campaign Name (técnico) */}
              <Field label="Campaign Name">
                <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} style={inputStyle} placeholder="Ex: BR_CAMPANHA-INSTITUCIONAL-2026_CPM" />
              </Field>

              {/* Conjunto / Ad Group */}
              <Field label="Ad Group">
                <input value={conjunto} onChange={(e) => setConjunto(e.target.value)} style={inputStyle} />
              </Field>

              {/* Ad Name */}
              <Field label="Ad Name">
                <input
                  value={adName}
                  onChange={(e) => setAdName(e.target.value)}
                  placeholder="Preenchido pelo BI -- deve bater exatamente com o Ad Name da planilha"
                  style={inputStyle}
                />
              </Field>

              {/* URL destino */}
              <Field label="URL de destino">
                <input value={urlDestino} onChange={(e) => setUrlDestino(e.target.value)} type="text" placeholder="https://" style={inputStyle} />
              </Field>

              {/* Segmentação */}
              <Field label="Segmentação">
                <textarea value={segmentacao} onChange={(e) => setSegmentacao(e.target.value)} rows={2} style={textareaStyle} placeholder="Descreva o público-alvo..." />
              </Field>

              {/* Título */}
              <Field label="Título do criativo">
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={inputStyle} />
              </Field>
            </>
          )}

          {abaAtiva === "notas" && (
            <>
              {/* Descrição */}
              <Field label="Descrição">
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} style={textareaStyle} />
              </Field>

              {/* Observações */}
              <Field label="Observações">
                <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} style={textareaStyle} />
              </Field>
            </>
          )}

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(220,38,38,0.1)", color: "var(--danger)", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {abaAtiva !== "basico" && (
              <button
                type="button"
                onClick={handleVoltar}
                style={{ padding: "11px 20px", borderRadius: 999, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Voltar
              </button>
            )}
            {abaAtiva !== "notas" ? (
              <button
                type="button"
                onClick={handleProximo}
                style={{ flex: 1, padding: "11px 0", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 999, border: "none", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Salvando..." : isEdit ? "Salvar alterações" : creative?._duplicate ? "Criar cópia" : "Criar criativo"}
              </button>
            )}
          </div>

        </div>
      </div>

      {confirmandoFechar && (
        <div
          onClick={() => setConfirmandoFechar(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(20,33,61,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 250 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 360, display: "flex", flexDirection: "column", gap: 14 }}>
            <strong style={{ fontSize: 15 }}>Alterações não salvas</strong>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Você preencheu campos deste criativo mas não confirmou a criação. Quer salvar como rascunho para continuar depois?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={handleSalvarRascunho}
                disabled={saving}
                style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Salvando..." : "Salvar como rascunho"}
              </button>
              <button
                onClick={handleDescartar}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Descartar
              </button>
              <button
                onClick={() => setConfirmandoFechar(false)}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
