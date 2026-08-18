import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { updateMyProfile } from "../api/client.js";
import Avatar from "../components/common/Avatar.jsx";
import UserManagement from "../components/profile/UserManagement.jsx";
import ChangePasswordForm from "../components/profile/ChangePasswordForm.jsx";
import VehicleManagement from "../components/profile/VehicleManagement.jsx";
import CampaignManagement from "../components/profile/CampaignManagement.jsx";
import PlatformManagement from "../components/profile/PlatformManagement.jsx";
import Ga4IntegrationsManagement from "../components/profile/Ga4IntegrationsManagement.jsx";
import SheetIntegrationsManagement from "../components/profile/SheetIntegrationsManagement.jsx";
import { papelLabel } from "../utils/papelLabel.js";

const TABS_AGENCIA = [
  { id: "veiculos", label: "Veículos" },
  { id: "plataformas", label: "Plataformas" },
  { id: "campanhas", label: "Campanhas" },
  { id: "usuarios", label: "Usuários" },
  { id: "ga4", label: "Integrações GA4" },
  { id: "planilhas", label: "Integrações de Planilha" },
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [nome, setNome] = useState(user.nome);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removerFoto, setRemoverFoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("veiculos");
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const photoMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(e.target)) {
        setPhotoMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
    if (selected) setRemoverFoto(false);
    setPhotoMenuOpen(false);
  }

  function handleRemovePhoto() {
    setFile(null);
    setPreview(null);
    setRemoverFoto(true);
    setPhotoMenuOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      const formData = new FormData();
      formData.append("nome", nome);
      if (file) formData.append("foto", file);
      if (removerFoto) formData.append("removerFoto", "true");
      await updateMyProfile(formData);
      await refreshUser();
      setRemoverFoto(false);
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Meu Perfil</h2>
      </div>

      {/* Card de dados pessoais + senha */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          {/* Avatar com lápis */}
          <div ref={photoMenuRef} style={{ position: "relative", flexShrink: 0 }}>
            <Avatar nome={nome} fotoUrl={removerFoto ? null : preview || user.fotoUrl} size={72} />

            {/* Botão lápis */}
            <button
              type="button"
              onClick={() => setPhotoMenuOpen((o) => !o)}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "2px solid var(--card-bg)",
                background: "var(--accent)",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
              title="Alterar foto"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            {/* Popover */}
            {photoMenuOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                zIndex: 200,
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(20,33,61,0.15)",
                padding: 6,
                minWidth: 180,
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-soft)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  {preview || user.fotoUrl ? "Alterar foto" : "Adicionar foto"}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                </label>
                {!removerFoto && (preview || user.fotoUrl) && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--danger)", textAlign: "left" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(220,38,38,0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    Remover foto
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPhotoMenuOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)", textAlign: "left" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-soft)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Fechar
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 18 }}>{user.nome}</strong>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>{user.email}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              {papelLabel(user)}
            </p>
          </div>
        </div>

        <div className="profile-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          {/* Dados */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: "var(--text-secondary)" }}>Dados pessoais</p>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Email</label>
              <input value={user.email} disabled style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", opacity: 0.6 }} />
            </div>
            {success && <p style={{ color: "var(--success)", fontSize: 13, margin: 0 }}>Perfil atualizado!</p>}
            <button type="submit" disabled={saving} style={{ padding: "9px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>

          {/* Senha */}
          <div>
            <p style={{ margin: "0 0 14px", fontWeight: 600, fontSize: 14, color: "var(--text-secondary)" }}>Segurança</p>
            <ChangePasswordForm />
          </div>
        </div>
      </div>

      {/* Seções da agência em abas */}
      {user.papel === "agencia" && (
        <div>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {TABS_AGENCIA.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px 8px 0 0",
                  border: "1px solid var(--border)",
                  borderBottom: activeTab === tab.id ? "1px solid var(--card-bg)" : "1px solid var(--border)",
                  background: activeTab === tab.id ? "var(--card-bg)" : "transparent",
                  color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: activeTab === tab.id ? 700 : 400,
                  fontSize: 13,
                  cursor: "pointer",
                  position: "relative",
                  bottom: -1,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conteúdo da aba */}
          <div>
            {activeTab === "veiculos" && <VehicleManagement />}
            {activeTab === "plataformas" && <PlatformManagement />}
            {activeTab === "campanhas" && <CampaignManagement />}
            {activeTab === "usuarios" && <UserManagement />}
            {activeTab === "ga4" && <Ga4IntegrationsManagement />}
            {activeTab === "planilhas" && <SheetIntegrationsManagement />}
          </div>
        </div>
      )}
    </div>
  );
}
