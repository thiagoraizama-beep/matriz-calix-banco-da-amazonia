// Tons derivados da identidade do Banco da Amazonia (verde escuro do simbolo +
// verde folha + neutros terrosos), em vez de cores vibrantes genericas.
const COLORS = ["#003D2A", "#1E9C6B", "#0B6E4F", "#2E7D32", "#4E6B4A", "#00695C"];

function colorForName(name) {
  const index = (name || "").charCodeAt(0) % COLORS.length;
  return COLORS[index] || COLORS[0];
}

export default function Avatar({ nome, fotoUrl, size = 36 }) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  const inicial = (nome || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: colorForName(nome),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 400,
        flexShrink: 0,
      }}
    >
      {inicial}
    </div>
  );
}
