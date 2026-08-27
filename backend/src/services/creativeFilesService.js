import { ZipArchive } from "archiver";
import { query } from "../config/database.js";
import { getCloudinaryClient } from "../config/cloudinary.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";

// archiver@8 nao exporta mais uma funcao factory default -- e um namespace
// com as classes ZipArchive/TarArchive/JsonArchive, instanciadas direto.
// Import ESM direto (nao createRequire) -- em producao na Vercel o bundler
// so expoe o entry ESM do pacote, e require() de um modulo ESM puro
// quebra com ERR_REQUIRE_ESM (derrubava toda a API, incluindo login).

// Arquivos ADICIONAIS de um criativo (ex: varios tamanhos de banner do mesmo
// anuncio Display) -- separado de creatives.cloudinary_url/public_id/tipo_midia,
// que continuam sendo o arquivo PRINCIPAL (preview do card, miniatura no
// Excel). Um criativo com upload simples nunca ganha linhas aqui.

export async function listFilesByCreative(creativeId) {
  const { rows } = await query(
    "SELECT * FROM creative_files WHERE creative_id = $1 ORDER BY ordem ASC, id ASC",
    [creativeId]
  );
  return rows;
}

// files: array de multer files (buffer, mimetype, originalname). Envia todos
// pro Cloudinary e insere numa unica passada -- ordem continua a partir do
// maior "ordem" ja existente pra novos arquivos entrarem sempre no fim.
export async function addCreativeFiles(creativeId, files) {
  if (!files?.length) return [];

  const { rows: maxRows } = await query(
    "SELECT COALESCE(MAX(ordem), -1) AS max_ordem FROM creative_files WHERE creative_id = $1",
    [creativeId]
  );
  let proximaOrdem = maxRows[0].max_ordem + 1;

  const inseridos = [];
  for (const file of files) {
    const upload = await uploadToCloudinary(file.buffer, file.mimetype, process.env.CLOUDINARY_CREATIVES_FOLDER);
    const tipoMidia = upload.resource_type === "video" ? "video" : "image";
    const { rows } = await query(
      `INSERT INTO creative_files (creative_id, cloudinary_public_id, cloudinary_url, tipo_midia, nome_original, ordem)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [creativeId, upload.public_id, upload.secure_url, tipoMidia, file.originalname || null, proximaOrdem]
    );
    inseridos.push(rows[0]);
    proximaOrdem += 1;
  }
  return inseridos;
}

// Mesmo resultado de addCreativeFiles, mas pra arquivos JA enviados direto
// do navegador pro Cloudinary (ver uploadDireto no frontend / gerarAssinaturaUpload
// no backend) -- so registra a URL no banco, sem reenviar o arquivo. Usado
// pra videos grandes, que dariam erro 413 se subissem via multipart pelo backend.
export async function addCreativeFilesJaEnviados(creativeId, arquivos) {
  if (!arquivos?.length) return [];

  const { rows: maxRows } = await query(
    "SELECT COALESCE(MAX(ordem), -1) AS max_ordem FROM creative_files WHERE creative_id = $1",
    [creativeId]
  );
  let proximaOrdem = maxRows[0].max_ordem + 1;

  const inseridos = [];
  for (const arquivo of arquivos) {
    const { rows } = await query(
      `INSERT INTO creative_files (creative_id, cloudinary_public_id, cloudinary_url, tipo_midia, ordem)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [creativeId, arquivo.cloudinaryPublicId, arquivo.cloudinaryUrl, arquivo.tipoMidia, proximaOrdem]
    );
    inseridos.push(rows[0]);
    proximaOrdem += 1;
  }
  return inseridos;
}

// Reordena os arquivos ADICIONAIS de um criativo (drag-and-drop no formulario
// de edicao) -- fileIds e a lista completa dos ids de creative_files na nova
// ordem desejada. A capa (creatives.cloudinary_url) fica sempre em primeiro
// no carrossel/zip (ver useSlides no frontend e gerarZipDoCreative acima),
// essa funcao so reordena os EXTRAS entre si.
export async function reordenarCreativeFiles(creativeId, fileIds) {
  for (let i = 0; i < fileIds.length; i++) {
    await query("UPDATE creative_files SET ordem = $1 WHERE id = $2 AND creative_id = $3", [i, fileIds[i], creativeId]);
  }
  return listFilesByCreative(creativeId);
}

export async function removeCreativeFile(fileId) {
  const { rows } = await query("SELECT * FROM creative_files WHERE id = $1", [fileId]);
  const arquivo = rows[0];
  if (!arquivo) return false;

  const cloudinary = getCloudinaryClient();
  await cloudinary.uploader.destroy(arquivo.cloudinary_public_id, {
    resource_type: arquivo.tipo_midia === "video" ? "video" : "image",
  });
  await query("DELETE FROM creative_files WHERE id = $1", [fileId]);
  return true;
}

// Troca qual arquivo e a capa/preview do criativo: o arquivo indicado
// (fileId, hoje um "extra" em creative_files) vira o principal
// (creatives.cloudinary_*), e o principal atual desce pra creative_files no
// lugar dele -- so troca as referencias, nao reenvia nada ao Cloudinary.
// "creative" e o registro completo (ja carregado pelo caller, pra nao criar
// dependencia circular com creativesService.js).
export async function definirCapa(creative, fileId) {
  const { rows } = await query("SELECT * FROM creative_files WHERE id = $1 AND creative_id = $2", [fileId, creative.id]);
  const novoPrincipal = rows[0];
  if (!novoPrincipal) return null;

  const { rows: atualizado } = await query(
    `UPDATE creatives SET cloudinary_public_id = $2, cloudinary_url = $3, tipo_midia = $4, atualizado_em = now()
     WHERE id = $1 RETURNING *`,
    [creative.id, novoPrincipal.cloudinary_public_id, novoPrincipal.cloudinary_url, novoPrincipal.tipo_midia]
  );
  await query("DELETE FROM creative_files WHERE id = $1", [fileId]);
  if (creative.cloudinary_public_id) {
    await query(
      `INSERT INTO creative_files (creative_id, cloudinary_public_id, cloudinary_url, tipo_midia, ordem)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(ordem) + 1 FROM creative_files WHERE creative_id = $1), 0))`,
      [creative.id, creative.cloudinary_public_id, creative.cloudinary_url, creative.tipo_midia]
    );
  }

  return atualizado[0];
}

function nomeArquivoValido(nome) {
  return (nome || "arquivo").replace(/[\\/:*?"<>|]/g, "-").trim() || "arquivo";
}

function extensaoPorTipo(tipoMidia, cloudinaryUrl) {
  const match = cloudinaryUrl?.match(/\.(\w+)(?:\?|$)/);
  if (match) return match[1];
  return tipoMidia === "video" ? "mp4" : "jpg";
}

// Zip com TODOS os arquivos de um criativo -- o principal (creative.*) mais
// os extras (creative_files) -- usado pelo botao "Baixar" do card quando o
// criativo tem mais de 1 arquivo. "creative" e o registro completo (ja
// carregado pelo caller, pra nao criar dependencia circular com
// creativesService.js).
export async function gerarZipDoCreative(creative) {
  const extras = await listFilesByCreative(creative.id);
  const nomeBase = nomeArquivoValido(creative.titulo || creative.nome || `criativo-${creative.id}`);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    (async () => {
      const todos = [];
      if (creative.cloudinary_url) {
        todos.push({ tipo_midia: creative.tipo_midia, cloudinary_url: creative.cloudinary_url });
      }
      todos.push(...extras);

      for (let i = 0; i < todos.length; i++) {
        const arquivo = todos[i];
        const extensao = extensaoPorTipo(arquivo.tipo_midia, arquivo.cloudinary_url);
        try {
          const resp = await fetch(arquivo.cloudinary_url);
          if (!resp.ok) continue;
          const buffer = Buffer.from(await resp.arrayBuffer());
          archive.append(buffer, { name: `${nomeBase}-${i + 1}.${extensao}` });
        } catch {
          // arquivo individual falhou ao baixar -- pula, nao derruba o zip inteiro
        }
      }
      archive.finalize();
    })();
  });
}

// Usado ao excluir o criativo definitivamente -- limpa todos os arquivos
// extras do Cloudinary antes do DELETE CASCADE apagar as linhas.
export async function removeAllCreativeFiles(creativeId) {
  const arquivos = await listFilesByCreative(creativeId);
  if (arquivos.length === 0) return;

  const cloudinary = getCloudinaryClient();
  for (const arquivo of arquivos) {
    await cloudinary.uploader.destroy(arquivo.cloudinary_public_id, {
      resource_type: arquivo.tipo_midia === "video" ? "video" : "image",
    });
  }
}
