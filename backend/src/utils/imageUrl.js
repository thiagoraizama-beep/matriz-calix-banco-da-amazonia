// Converte links de compartilhamento do Google Drive (.../file/d/FILE_ID/view?...)
// para o formato de embed direto, que funciona em tag <img> sem bloqueio de hotlink.
// Outras URLs (ja diretas, ou de outros servicos) passam sem alteracao.
const DRIVE_FILE_ID_PATTERN = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_ID_PATTERN = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;

export function normalizeImageUrl(url) {
  if (!url) return url;

  const fileMatch = url.match(DRIVE_FILE_ID_PATTERN);
  const openMatch = url.match(DRIVE_OPEN_ID_PATTERN);
  const fileId = fileMatch?.[1] || openMatch?.[1];

  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  return url;
}
