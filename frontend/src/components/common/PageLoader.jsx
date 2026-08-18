export default function PageLoader({ pageName }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        zIndex: 1000,
      }}
    >
      <span style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
              animation: "dot-bounce 1.1s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </span>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
        Carregando {pageName}...
      </p>
    </div>
  );
}
