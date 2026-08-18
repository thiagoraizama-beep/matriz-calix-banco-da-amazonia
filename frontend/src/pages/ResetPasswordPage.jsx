import { useEffect, useState } from "react";
import { validateResetToken, confirmPasswordReset } from "../api/client.js";

function getTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

export default function ResetPasswordPage() {
  const [token] = useState(getTokenFromUrl);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    validateResetToken(token)
      .then((r) => setValid(r.valid))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (senha !== confirmSenha) {
      setError("As senhas não coincidem");
      return;
    }
    if (senha.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(token, senha);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível redefinir a senha");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 38px 10px 38px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: 14,
  };

  function goToLogin() {
    window.location.href = "/";
  }

  return (
    <div
      className="login-page-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('/hero-cover.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#fff" }}>Redefinir senha</h1>
        </div>

        {checking ? (
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, textAlign: "center" }}>Verificando link...</p>
        ) : !valid ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p
              style={{
                background: "rgba(220,38,38,0.2)",
                border: "1px solid rgba(220,38,38,0.4)",
                color: "#fecaca",
                fontSize: 13,
                fontWeight: 500,
                margin: 0,
                padding: "12px 16px",
                borderRadius: 8,
              }}
            >
              Este link é inválido ou já expirou. Solicite um novo pela tela de login.
            </p>
            <button
              type="button"
              onClick={goToLogin}
              style={{
                padding: "12px 0",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Voltar ao login
            </button>
          </div>
        ) : done ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p
              style={{
                background: "rgba(22,163,74,0.2)",
                border: "1px solid rgba(22,163,74,0.4)",
                color: "#bbf7d0",
                fontSize: 13,
                fontWeight: 500,
                margin: 0,
                padding: "12px 16px",
                borderRadius: 8,
              }}
            >
              Senha redefinida com sucesso.
            </p>
            <button
              type="button"
              onClick={goToLogin}
              style={{
                padding: "12px 0",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Nova senha</label>
              <div style={{ position: "relative", marginTop: 6 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.75)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="login-input"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.75)",
                    display: "flex",
                  }}
                >
                  {showSenha ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Confirmar senha</label>
              <div style={{ position: "relative", marginTop: 6 }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.75)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showSenha ? "text" : "password"}
                  value={confirmSenha}
                  onChange={(e) => setConfirmSenha(e.target.value)}
                  required
                  className="login-input"
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <p
                style={{
                  background: "rgba(220,38,38,0.2)",
                  border: "1px solid rgba(220,38,38,0.4)",
                  color: "#fecaca",
                  fontSize: 13,
                  fontWeight: 500,
                  margin: 0,
                  padding: "12px 16px",
                  borderRadius: 8,
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 0",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
