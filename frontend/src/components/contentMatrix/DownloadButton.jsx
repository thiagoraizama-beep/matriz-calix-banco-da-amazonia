function toDownloadUrl(url, filename) {
  const safe = filename.replace(/[^a-zA-Z0-9_\-]/g, "_");
  return url.replace("/upload/", `/upload/fl_attachment:${safe}/`);
}

function buildFilename(creative) {
  const parts = [];
  if (creative.plataforma) parts.push(creative.plataforma);
  if (creative.ad_name) parts.push(creative.ad_name);
  return parts.length ? parts.join("_") : creative.nome;
}

export default function DownloadButton({ creative, compact }) {
  const filename = buildFilename(creative);
  return (
    <a
      href={toDownloadUrl(creative.cloudinary_url, filename)}
      download={filename}
      title="Baixar criativo"
      aria-label="Baixar criativo"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: compact ? "4px 10px" : "6px 12px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text-primary)",
        fontSize: 12,
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v12" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {!compact && "Baixar"}
    </a>
  );
}
