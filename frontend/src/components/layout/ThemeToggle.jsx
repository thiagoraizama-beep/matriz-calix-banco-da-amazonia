import { useTheme } from "../../context/ThemeContext.jsx";

function SunIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "currentColor"} strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

const SIZE = 30;
const PADDING = 3;

// Toggle em formato de chave/pill: dois icones lado a lado, com o lado ativo
// destacado por um circulo branco deslizante conforme o tema selecionado.
export default function ThemeToggle({ variant = "onImage" }) {
  const { theme, toggleTheme } = useTheme();
  const onImage = variant === "onImage";
  const isLight = theme === "light";

  return (
    <button
      onClick={toggleTheme}
      title={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
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
      }}
    >
      <span
        style={{
          position: "absolute",
          top: PADDING,
          left: isLight ? PADDING : SIZE + PADDING,
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
          position: "absolute",
          top: PADDING,
          left: PADDING,
          width: SIZE,
          height: SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        <SunIcon active={isLight} />
      </span>
      <span
        style={{
          position: "absolute",
          top: PADDING,
          left: SIZE + PADDING,
          width: SIZE,
          height: SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          color: onImage ? "#fff" : "var(--text-secondary)",
        }}
      >
        <MoonIcon active={!isLight} />
      </span>
    </button>
  );
}
