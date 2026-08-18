// Dados de exemplo no mesmo formato esperado da planilha real (uma linha por dia/campanha/veiculo).
// Servem para desenvolver e validar o dashboard antes da planilha do cliente chegar.

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const veiculos = ["Google Ads", "Meta Ads", "Portal G1", "UOL", "YouTube"];
const campanhas = [
  { nome: "Campanha Institucional 2026", ultimoDiaAtras: 1 },
  { nome: "Campanha Orcamento Publico", ultimoDiaAtras: 14 }, // deve aparecer como inativa
];

function seedRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

export const realizado = [];
const rand = seedRandom(42);

for (const campanha of campanhas) {
  for (let i = campanha.ultimoDiaAtras; i < campanha.ultimoDiaAtras + 30; i++) {
    for (const veiculo of veiculos) {
      const impressoes = Math.round(5000 + rand() * 20000);
      const cliques = Math.round(impressoes * (0.01 + rand() * 0.03));
      const visualizacoes = Math.round(impressoes * (0.2 + rand() * 0.3));
      const investimento = Math.round(cliques * (1.5 + rand() * 2));
      realizado.push({
        data: daysAgo(i),
        campanha: campanha.nome,
        veiculo,
        investimento,
        impressoes,
        cliques,
        visualizacoes,
        sessoes: Math.round(visualizacoes * (0.4 + rand() * 0.2)),
        tempoMedioSegundos: Math.round(40 + rand() * 120),
        custoPorSessao: Number((1 + rand() * 3).toFixed(2)),
      });
    }
  }
}

export const planejamento = [
  { campanha: "Campanha Institucional 2026", veiculo: "Google Ads", contratado: 500000 },
  { campanha: "Campanha Institucional 2026", veiculo: "Meta Ads", contratado: 400000 },
  { campanha: "Campanha Institucional 2026", veiculo: "Portal G1", contratado: 300000 },
  { campanha: "Campanha Institucional 2026", veiculo: "UOL", contratado: 250000 },
  { campanha: "Campanha Institucional 2026", veiculo: "YouTube", contratado: 200000 },
  { campanha: "Campanha Orcamento Publico", veiculo: "Google Ads", contratado: 150000 },
  { campanha: "Campanha Orcamento Publico", veiculo: "Meta Ads", contratado: 120000 },
  { campanha: "Campanha Orcamento Publico", veiculo: "Portal G1", contratado: 100000 },
  { campanha: "Campanha Orcamento Publico", veiculo: "UOL", contratado: 90000 },
  { campanha: "Campanha Orcamento Publico", veiculo: "YouTube", contratado: 80000 },
];

export const veiculoLogos = {
  "Google Ads": "/logos/google-ads.svg",
  "Meta Ads": "/logos/meta-ads.svg",
  "Portal G1": "/logos/g1.svg",
  UOL: "/logos/uol.svg",
  YouTube: "/logos/youtube.svg",
};
