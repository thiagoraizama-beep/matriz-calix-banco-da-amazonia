const SIZE = 30;
const PADDING = 3;

// Toggle em formato de chave/pill generico -- mesmo padrao visual do
// ThemeToggle (dois icones lado a lado, lado ativo destacado por um circulo
// branco deslizante), mas parametrizado pra qualquer par de opcoes (ex:
// Grade/Kanban), nao so tema.
export default function SlidingToggle({ active, onToggle, iconLeft, iconRight, titleLeft, titleRight, variant = "plain" }) {
  const onImage = variant === "onImage";
  const isLeft = active === "left";

  return (
    <button
      onClick={onToggle}
      title={isLeft ? titleRight : titleLeft}
      style={{
        position: "relative",
        display: "block",
        boxSizing: "content-box",
        width: SIZE * 2,
        height: SIZE,
        padding: PADDING,
        margin: 0,
        borderRadius: 999,
        border: onImage ? "1px solid rgba(255,255,255,0.4)" : "1px solid var(--border)",
        background: onImage ? "rgba(255,255,255,0.08)" : "var(--card-bg)",
        cursor: "pointer",
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: PADDING,
          left: isLeft ? PADDING : SIZE + PADDING,
          width: SIZE,
          height: SIZE,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(20,33,61,0.25)",
          transition: "left 0.2s ease",
        }}
      />
      <span
        style={{
          position: "absolute", top: PADDING, left: PADDING, width: SIZE, height: SIZE,
          display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          color: isLeft ? "var(--accent)" : onImage ? "#fff" : "var(--text-secondary)",
        }}
      >
        {iconLeft}
      </span>
      <span
        style={{
          position: "absolute", top: PADDING, left: SIZE + PADDING, width: SIZE, height: SIZE,
          display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          color: !isLeft ? "var(--accent)" : onImage ? "#fff" : "var(--text-secondary)",
        }}
      >
        {iconRight}
      </span>
    </button>
  );
}
