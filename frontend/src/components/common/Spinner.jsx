export default function Spinner({ size = 28, fullHeight = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: fullHeight ? 0 : 24,
        minHeight: fullHeight ? "100%" : undefined,
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
          display: "inline-block",
          animation: "spin 0.7s linear infinite",
        }}
      />
    </div>
  );
}
