import { getCloudinaryClient } from "../config/cloudinary.js";

const CACHE_TTL_MS = 60_000;
let cache = null;
let cacheTimestamp = 0;

// Normaliza nomes para comparacao tolerante: maiusculas, sem extensao, so alfanumerico.
function normalizeName(name) {
  return (name || "")
    .toUpperCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^A-Z0-9]/g, "");
}

// Lista todos os recursos da conta Cloudinary (imagens e videos). Os uploads de criativos
// nao usam necessariamente o prefixo de pasta no public_id (depende de como o upload foi
// feito na interface), entao buscamos sem filtro de pasta e confiamos no nome do arquivo
// para o match.
async function listAllResources() {
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cache;
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    cache = [];
    cacheTimestamp = Date.now();
    return cache;
  }

  const cloudinary = getCloudinaryClient();
  const [images, videos] = await Promise.all([
    cloudinary.api.resources({ type: "upload", resource_type: "image", max_results: 500 }),
    cloudinary.api.resources({ type: "upload", resource_type: "video", max_results: 500 }),
  ]);

  cache = [...(images.resources || []), ...(videos.resources || [])];
  cacheTimestamp = Date.now();
  return cache;
}

// Exige que o nome do criativo (adName/nomeCriativo) esteja quase inteiro contido no nome
// do arquivo, ou vice-versa, com uma sobreposicao minima de tamanho. Isso evita que nomes
// de arquivo curtos/genericos (ex: thumbnails extraidas de video) deem match com qualquer
// criativo cujo nome contenha aquele trecho.
const MIN_OVERLAP_RATIO = 0.7;

function isCloseMatch(fileNormalized, candidate) {
  if (fileNormalized === candidate) return true;
  if (fileNormalized.includes(candidate)) {
    return candidate.length / fileNormalized.length >= MIN_OVERLAP_RATIO;
  }
  if (candidate.includes(fileNormalized)) {
    return fileNormalized.length / candidate.length >= MIN_OVERLAP_RATIO;
  }
  return false;
}

// Cruza adName/nomeCriativo do criativo com o public_id de cada arquivo no Cloudinary.
// Quando o nome do arquivo tambem carrega o sufixo do veiculo (ex: "..._META", "..._TIKTOK"),
// usamos isso para desambiguar criativos com o mesmo nome em veiculos diferentes.
// Retorna { url, tipo: "image" | "video" } se achar correspondencia, ou null.
export async function findCreativeMedia(adName, nomeCriativo, veiculoOpcao) {
  const resources = await listAllResources();
  if (resources.length === 0) return null;

  const candidates = [normalizeName(adName), normalizeName(nomeCriativo)].filter(Boolean);
  const veiculoTag = normalizeName(veiculoOpcao);

  const matches = resources.filter((resource) => {
    const fileName = resource.public_id.split("/").pop();
    const fileNormalized = normalizeName(fileName);
    return candidates.some((c) => isCloseMatch(fileNormalized, c));
  });

  if (matches.length === 0) return null;
  if (matches.length === 1) return { url: matches[0].secure_url, tipo: matches[0].resource_type };

  // Mais de um arquivo bateu o nome. Se o sufixo do veiculo desambiguar, usa ele.
  const byVeiculo = veiculoTag
    ? matches.find((resource) => normalizeName(resource.public_id.split("/").pop()).includes(veiculoTag))
    : null;
  if (byVeiculo) return { url: byVeiculo.secure_url, tipo: byVeiculo.resource_type };

  // Sem sufixo de veiculo: verifica se sao duplicatas do mesmo arquivo (nome base identico,
  // ignorando so o sufixo aleatorio que o Cloudinary adiciona ao public_id). Nesse caso,
  // nao ha ambiguidade real de veiculo - usa o upload mais recente.
  const baseNames = new Set(matches.map((r) => stripCloudinarySuffix(r.public_id.split("/").pop())));
  if (baseNames.size === 1) {
    const mostRecent = matches.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    return { url: mostRecent.secure_url, tipo: mostRecent.resource_type };
  }

  // Nomes base diferentes e nenhum sufixo de veiculo: ambiguidade real, nao escolhe nenhum.
  return null;
}

// Remove o sufixo aleatorio (6-8 caracteres alfanumericos) que o Cloudinary acrescenta
// apos o ultimo "_" no public_id quando ha colisao de nome (ex: "nome_bqktcr" -> "nome").
function stripCloudinarySuffix(fileName) {
  const lastUnderscore = fileName.lastIndexOf("_");
  const suffix = fileName.slice(lastUnderscore + 1);
  const looksLikeRandomSuffix = lastUnderscore > 0 && /^[a-z0-9]{6,8}$/i.test(suffix);
  const base = looksLikeRandomSuffix ? fileName.slice(0, lastUnderscore) : fileName;
  return normalizeName(base);
}
