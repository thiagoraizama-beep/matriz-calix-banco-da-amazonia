import { useEffect, useState } from "react";
import { getRegisteredVehicles, createVehicle, updateVehicle, deleteVehicle } from "../../api/client.js";
import Avatar from "../common/Avatar.jsx";
import TrashIcon from "../common/TrashIcon.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  function load() {
    getRegisteredVehicles().then(setVehicles).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    await deleteVehicle(deleting.id);
    setDeleting(null);
    load();
  }

  function openEdit(vehicle) {
    setEditing(vehicle);
    setFormOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p className="card-title" style={{ margin: 0 }}>Veículos</p>
        <button
          onClick={openCreate}
          style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + Novo veículo
        </button>
      </div>

      {formOpen && (
        <VehicleForm
          vehicle={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { load(); setFormOpen(false); setEditing(null); }}
        />
      )}

      {!vehicles ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Carregando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {vehicles.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar nome={v.nome} fotoUrl={v.logo_url} size={32} />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 13 }}>{v.nome}</strong>
              </div>
              <button
                onClick={() => openEdit(v)}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
              >
                Editar
              </button>
              <button
                onClick={() => setDeleting(v)}
                title="Excluir veículo"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: "pointer" }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
          {vehicles.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Nenhum veículo cadastrado ainda</p>
          )}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir veículo"
          message={`Tem certeza que deseja excluir "${deleting.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function VehicleForm({ vehicle, onClose, onSaved }) {
  const isEdit = Boolean(vehicle);
  const [nome, setNome] = useState(vehicle?.nome || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(vehicle?.logo_url || null);
  const [removerLogo, setRemoverLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setRemoverLogo(false);
    setPreview(f ? URL.createObjectURL(f) : vehicle?.logo_url || null);
  }

  function handleRemoveLogo() {
    setFile(null);
    setPreview(null);
    setRemoverLogo(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("nome", nome);
      if (file) formData.append("logo", file);
      if (removerLogo) formData.append("removerLogo", "true");
      if (isEdit) {
        await updateVehicle(vehicle.id, formData);
      } else {
        await createVehicle(formData);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar veículo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}
    >
      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nome do veículo</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          placeholder="Ex: Go On Ad Group"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Logo (imagem)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          {preview ? (
            <img
              src={preview}
              alt="preview"
              style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }}
            />
          ) : (
            <div
              style={{
                width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "var(--text-secondary)", textAlign: "center",
              }}
            >
              sem logo
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ flex: 1 }} />
          {preview && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
