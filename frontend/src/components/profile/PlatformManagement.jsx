import { useEffect, useState } from "react";
import {
  getPlataformas,
  createPlataforma,
  updatePlataforma,
  deletePlataforma,
} from "../../api/client.js";
import Avatar from "../common/Avatar.jsx";
import TrashIcon from "../common/TrashIcon.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import MultiSelectDropdown from "../layout/MultiSelectDropdown.jsx";

// Subcanais sugeridos: usar os nomes EXATOS que aparecem na coluna "Veículo" da
// aba Realizado da planilha. Ex: se a planilha tem linhas separadas "Facebook" e
// "Instagram", cadastre a plataforma "Meta Ads" com subcanais ["Facebook",
// "Instagram"] para que Analise por Criativo some as duas e ofereca o filtro de
// plataforma entre elas. Deixe vazio se a plataforma ja tem nome unico na planilha.
const SUBCANAIS_SUGERIDOS = [
  "Facebook", "Instagram", "Tik Tok", "YouTube", "Kwai", "Deezer", "Spotify", "Netflix",
  "UOL", "AdMax", "Hands", "NewCom", "Diário dos Associados",
  "Portal R7", "globo.com",
  "TV Globo", "SBT", "Record", "Band", "TV Cultura",
  "Rádio CBN", "Rádio Jovem Pan", "Rádio Bandeirantes",
  "DOOH Metro", "DOOH Aeroporto", "DOOH Painel Digital", "MINIDOOR",
];

const TIPO_OPTIONS = ["Online", "Offline", "Online e Offline"];
const TIPO_FROM_LABEL = { Online: "online", Offline: "offline", "Online e Offline": "ambos" };
const TIPO_LABEL = { online: "Online", offline: "Offline", ambos: "Online e Offline" };

export default function PlatformManagement() {
  const [plataformas, setPlataformas] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  function load() {
    getPlataformas().then(setPlataformas).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    await deletePlataforma(deleting.id);
    setDeleting(null);
    load();
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p className="card-title" style={{ margin: 0 }}>Plataformas</p>
        <button
          onClick={() => { setFormOpen(true); setEditing(null); }}
          style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + Nova plataforma
        </button>
      </div>

      {formOpen && (
        <PlatformForm
          plataforma={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { load(); setFormOpen(false); setEditing(null); }}
        />
      )}

      {!plataformas ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Carregando...</p>
      ) : plataformas.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Nenhuma plataforma cadastrada ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {plataformas.map((p) => (
            <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar nome={p.nome} fotoUrl={p.logo_url} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{p.nome}</strong>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize" }}>
                    ({TIPO_LABEL[p.tipo] || p.tipo})
                  </span>
                  {p.subcanais?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {p.subcanais.map((s) => (
                        <span key={s} style={{ padding: "1px 7px", borderRadius: 999, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 11 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setEditing(p); setFormOpen(true); }}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, cursor: "pointer" }}
                >
                  Editar
                </button>
                <button
                  onClick={() => setDeleting(p)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: "pointer" }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir plataforma"
          message={`Tem certeza que deseja excluir "${deleting.nome}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function PlatformForm({ plataforma, onClose, onSaved }) {
  const isEdit = Boolean(plataforma);
  const [nome, setNome] = useState(plataforma?.nome || "");
  const [tipo, setTipo] = useState(plataforma?.tipo || "online");
  // Descarta subcanais salvos que nao existem mais na lista de sugestoes atual
  // (ex: "Meta" de um cadastro antigo, substituido por "Facebook"/"Instagram").
  const [subcanais, setSubcanais] = useState(
    (plataforma?.subcanais || []).filter((s) => SUBCANAIS_SUGERIDOS.includes(s))
  );
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(plataforma?.logo_url || null);
  const [removerLogo, setRemoverLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setRemoverLogo(false);
    setPreview(f ? URL.createObjectURL(f) : plataforma?.logo_url || null);
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
      formData.append("tipo", tipo);
      formData.append("subcanais", JSON.stringify(subcanais));
      if (file) formData.append("logo", file);
      if (removerLogo) formData.append("removerLogo", "true");
      if (isEdit) {
        await updatePlataforma(plataforma.id, formData);
      } else {
        await createPlataforma(formData);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Erro ao salvar plataforma");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nome da plataforma</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Ex: Meta Ads, TV Globo, Programática..."
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Tipo</label>
          <MultiSelectDropdown
            value={TIPO_LABEL[tipo] || "Online"}
            onChange={(v) => setTipo(TIPO_FROM_LABEL[v] || "online")}
            options={TIPO_OPTIONS}
            placeholder="Selecione"
          />
        </div>
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

      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Subcanais (nomes exatos na coluna "Veículo" da planilha)
        </label>
        <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 4px" }}>
          Ex: plataforma "Meta Ads" com subcanais "Facebook" e "Instagram" -- soma as duas e habilita o filtro de plataforma em Análise por Criativo. Deixe vazio se a plataforma já tem nome único na planilha.
        </p>
        <MultiSelectDropdown
          multi
          value={subcanais}
          onChange={setSubcanais}
          options={SUBCANAIS_SUGERIDOS}
          placeholder="Selecione os subcanais (se aplicável)"
        />
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
