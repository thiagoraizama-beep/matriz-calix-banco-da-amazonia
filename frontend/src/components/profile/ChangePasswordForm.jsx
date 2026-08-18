import { useState } from "react";
import { changeMyPassword } from "../../api/client.js";

export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (novaSenha !== confirmarSenha) {
      setError("As senhas não coincidem");
      return;
    }

    setSaving(true);
    try {
      await changeMyPassword(senhaAtual, novaSenha);
      setSuccess(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setTimeout(() => setOpen(false), 1500);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div
        className="card"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%" }}
      >
        <p className="card-title" style={{ margin: 0 }}>
          Senha
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Alterar senha
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p className="card-title" style={{ margin: 0 }}>
          Alterar senha
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}
        >
          ×
        </button>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Senha atual</label>
        <input
          type="password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Nova senha</label>
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          required
          minLength={6}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Confirmar nova senha</label>
        <input
          type="password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          required
          minLength={6}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
        />
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      {success && <p style={{ color: "var(--success)", fontSize: 13, margin: 0 }}>Senha alterada com sucesso!</p>}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: "10px 0",
          borderRadius: 8,
          border: "none",
          background: "var(--accent)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Salvando..." : "Alterar senha"}
      </button>
    </form>
  );
}
