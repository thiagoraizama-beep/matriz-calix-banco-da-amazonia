import { useTheme } from "../../context/ThemeContext.jsx";

export default function Footer() {
  const { theme } = useTheme();

  return (
    <footer
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 70px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span className="footer-bi-text" style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center" }}>
        Business Intelligence da Agência Cálix • Insights
      </span>
      <img
        className="footer-calix-logo"
        src="/CLX_branco.png"
        alt="Cálix"
        style={{
          position: "absolute",
          right: 24,
          height: 22,
          objectFit: "contain",
          filter: theme === "dark" ? "none" : "grayscale(1) invert(1) opacity(0.55)",
        }}
      />
    </footer>
  );
}
