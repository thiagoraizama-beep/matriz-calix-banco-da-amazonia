import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  getUsers,
  createUserAccount,
  deleteUserAccount,
  updateUserAccount,
  getRegisteredVehicles,
} from "../../api/client.js";
import Avatar from "../common/Avatar.jsx";
import TrashIcon from "../common/TrashIcon.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import MultiSelectDropdown from "../layout/MultiSelectDropdown.jsx";

const PAPEL_LABELS = { agencia: "Agência", veiculo: "Veículo", cliente: "Cliente", parceiro: "Parceiro" };
const PAPEL_OPTIONS = ["Agência", "Veículo", "Cliente"];
const PAPEL_FROM_LABEL = { Agência: "agencia", Veículo: "veiculo", Cliente: "cliente" };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleting, setDeleting] = useState(null);

  function load() {
    getUsers().then(setUsers).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    await deleteUserAccount(deleting.id);
    setDeleting(null);
    load();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p className="card-title" style={{ margin: 0 }}>Usuários</p>
        <button
          onClick={() => { setFormOpen((o) => !o); setEditingUser(null); }}
          style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          {formOpen ? "Cancelar" : "+ Novo usuário"}
        </button>
      </div>

      {formOpen && (
        <UserForm onDone={() => { load(); setFormOpen(false); }} />
      )}

      {!users ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Carregando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => (
            <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar nome={u.nome} fotoUrl={u.fotoUrl} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{u.nome}</strong>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.email}
                  </p>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  {PAPEL_LABELS[u.papel] || u.papel}
                  {u.veiculos?.length > 0 && ` · ${u.veiculos.join(", ")}`}
                </span>
                {u.id !== currentUser.id && (
                  <>
                    <button
                      onClick={() => { setEditingUser(editingUser?.id === u.id ? null : u); setFormOpen(false); }}
                      style={{
                        padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
                        background: editingUser?.id === u.id ? "var(--accent-soft)" : "transparent",
                        color: editingUser?.id === u.id ? "var(--accent)" : "var(--text-secondary)",
                        fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleting(u)}
                      title="Excluir usuário"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: "pointer" }}
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>

              {editingUser?.id === u.id && (
                <UserForm
                  user={u}
                  onDone={() => { load(); setEditingUser(null); }}
                  onCancel={() => setEditingUser(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Excluir usuário"
          message={`Tem certeza que deseja excluir "${deleting.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function UserForm({ user, onDone, onCancel }) {
  const isEdit = Boolean(user);
  const [nome, setNome] = useState(user?.nome || "");
  const [email, setEmail] = useState(user?.email || "");
  const [senha, setSenha] = useState("");
  const [papelLabel, setPapelLabel] = useState(PAPEL_LABELS[user?.papel] || "Cliente");
  const [veiculosSelecionados, setVeiculosSelecionados] = useState(user?.veiculos || []);
  const [vehicles, setVehicles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const papel = PAPEL_FROM_LABEL[papelLabel] || "cliente";
  const isVeiculo = papel === "veiculo";

  useEffect(() => {
    getRegisteredVehicles().then(setVehicles).catch(console.error);
  }, []);

  // Assim que a lista real de veiculos carrega, descarta da selecao qualquer nome
  // que nao exista mais (veiculo excluido/renomeado desde que este usuario foi
  // vinculado) -- evita "fantasma" contando como selecionado sem poder ser
  // desmarcado na UI.
  useEffect(() => {
    if (vehicles.length === 0) return;
    const nomesValidos = new Set(vehicles.map((v) => v.nome));
    setVeiculosSelecionados((prev) => prev.filter((nome) => nomesValidos.has(nome)));
  }, [vehicles]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        nome,
        email,
        papel,
        veiculos: isVeiculo ? veiculosSelecionados : [],
      };

      if (isEdit) {
        await updateUserAccount(user.id, payload);
      } else {
        if (!senha) { setError("Senha obrigatória"); setSaving(false); return; }
        await createUserAccount({ ...payload, senha });
      }
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex", flexDirection: "column", gap: 10,
        padding: 12, borderRadius: 8, background: "var(--bg)",
        marginLeft: isEdit ? 42 : 0,
        marginBottom: isEdit ? 0 : 16,
        paddingBottom: 16,
        borderBottom: isEdit ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Papel</label>
          <MultiSelectDropdown
            value={papelLabel}
            onChange={(v) => v && setPapelLabel(v)}
            options={PAPEL_OPTIONS}
            placeholder="Selecione"
          />
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
        />
      </div>

      {!isEdit && (
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </div>
      )}

      {isVeiculo && (
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Veículos vinculados
            <span style={{ fontWeight: 400, marginLeft: 4 }}>(selecione os veículos cadastrados que este usuário representa)</span>
          </label>
          {vehicles.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--danger)", margin: "4px 0 0" }}>
              Nenhum veículo cadastrado. Cadastre veículos na aba Veículos primeiro.
            </p>
          ) : (
            <MultiSelectDropdown
              multi
              value={veiculosSelecionados}
              onChange={setVeiculosSelecionados}
              options={vehicles.map((v) => v.nome)}
              placeholder="Selecione os veículos"
            />
          )}
          <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            As campanhas e plataformas são configuradas na seção <strong>Campanhas</strong>.
          </p>
        </div>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
        </button>
        {isEdit && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
