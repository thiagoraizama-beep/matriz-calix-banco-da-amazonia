// Nuvem de palavras-chave -- mostrada no lugar do preview de imagem/video
// quando o criativo e Google Search (sem peca visual). Sem lib externa (nao
// ha nenhuma instalada no projeto): SVG simples com <text> por palavra,
// tamanho uniforme (sem peso/frequencia real no dado), so a posicao variada
// num grid com jitter leve pra parecer organico sem overlap.
function splitPalavras(palavrasChave) {
  if (!palavrasChave) return [];
  return palavrasChave
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Gera um offset pseudo-aleatorio determinístico a partir do indice, pra a
// nuvem nao "pular" a cada re-render (sem usar Math.random puro).
function jitter(seed, amplitude) {
  const x = Math.sin(seed * 999) * 10000;
  return (x - Math.floor(x) - 0.5) * 2 * amplitude;
}

const CORES = ["var(--accent)", "var(--text-primary)", "var(--text-secondary)"];

export default function KeywordCloud({ palavrasChave, width = 280, height = 220 }) {
  const palavras = splitPalavras(palavrasChave);

  if (palavras.length === 0) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 12.5, textAlign: "center", padding: 16 }}>
        Sem palavras-chave cadastradas
      </div>
    );
  }

  const colunas = Math.ceil(Math.sqrt(palavras.length * (width / height)));
  const linhas = Math.ceil(palavras.length / colunas);
  const cellW = width / colunas;
  const cellH = height / linhas;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      <rect x="0" y="0" width={width} height={height} fill="var(--bg)" />
      {palavras.map((palavra, i) => {
        const col = i % colunas;
        const row = Math.floor(i / colunas);
        const cx = col * cellW + cellW / 2 + jitter(i, cellW * 0.18);
        const cy = row * cellH + cellH / 2 + jitter(i + 0.5, cellH * 0.18);
        const rot = jitter(i + 0.25, 6);
        return (
          <text
            key={i}
            x={cx}
            y={cy}
            fontSize={13}
            fontWeight={600}
            fill={CORES[i % CORES.length]}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${rot} ${cx} ${cy})`}
          >
            {palavra}
          </text>
        );
      })}
    </svg>
  );
}
