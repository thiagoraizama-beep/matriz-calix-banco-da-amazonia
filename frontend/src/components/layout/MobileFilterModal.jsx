export default function MobileFilterModal({ title = "Filtros", onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,14,25,0.5)",
        zIndex: 40,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p className="card-title" style={{ margin: 0 }}>
            {title}
          </p>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-secondary)" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
