// Mapeia o nome do veiculo (como aparece na planilha) para o arquivo PNG correspondente
// em /public/vehicle-logos/. Coloque os arquivos PNG nessa pasta com esses nomes exatos.
const LOGO_FILES = {
  Meta: "meta.png",
  "Tik Tok": "tiktok.png",
  Kwai: "kwai.png",
  YouTube: "youtube.png",
  AdMax: "admax.png",
  Deezer: "deezer.png",
  "Diário dos Associados": "diario-dos-associados.png",
  "Globo.com": "globo.png",
  Hands: "hands.png",
  NewCom: "newcom.png",
  "R7 Portal": "r7.svg",
  Spotify: "spotify.png",
  UOL: "uol.png",
  Netflix: "netflix.png",
};

export function getVehicleLogoUrl(veiculo) {
  const file = LOGO_FILES[veiculo];
  return file ? `/vehicle-logos/${file}` : null;
}
