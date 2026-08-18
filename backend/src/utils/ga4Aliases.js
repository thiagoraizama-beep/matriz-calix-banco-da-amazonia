// O GA4 identifica trafego via UTM (sessionSource/sessionCampaignName), que usa slugs
// diferentes dos nomes legiveis usados no dashboard (ex: "Globo.com" -> "globocom").
// Este mapa converte o nome do dashboard para o(s) valor(es) equivalentes no GA4.
// "Meta" usa "fb"/"ig" como source; a tag de campanha do Instagram esta quebrada (vem
// como ID do anuncio em vez do nome), por isso o filtro de veiculo nao depende da campanha.
export const VEICULO_PARA_GA4_SOURCE = {
  Meta: ["fb", "ig"],
  "Tik Tok": ["tiktok"],
  Kwai: ["kwai"],
  YouTube: ["youtube"],
  AdMax: ["admax"],
  Deezer: ["deezer"],
  "Diário dos Associados": ["diario_dos_associados"],
  "Globo.com": ["globocom"],
  Hands: ["hands"],
  NewCom: ["newcom"],
  "R7 Portal": ["r7_portal"],
  Spotify: ["spotify"],
  UOL: ["uol"],
  Netflix: ["netflix"],
};

export const CAMPANHA_PARA_GA4_CAMPAIGN = {
  "Campanha Institucional 2026": ["2026_campanha_institucional_2026", "2025_campanha_institucional_2026"],
};

export function getGA4SourcesEquivalentes(veiculo) {
  return VEICULO_PARA_GA4_SOURCE[veiculo] || [veiculo];
}

export function getGA4CampaignsEquivalentes(campanha) {
  return CAMPANHA_PARA_GA4_CAMPAIGN[campanha] || [campanha];
}
