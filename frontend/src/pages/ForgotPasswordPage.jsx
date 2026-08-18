import { useState } from "react";
import { requestPasswordReset } from "../api/client.js";

export default function ForgotPasswordPage({ onBack }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível enviar o link. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 12px 10px 38px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    fontSize: 14,
  };

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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#fff" }}>Recuperar senha</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, margin: "8px 0 0" }}>
            Informe seu e-mail e enviaremos um link para redefinir sua senha
          </p>
        </div>

        {sent ? (
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
              Enviamos um link de recuperação para o seu e-mail.
            </p>
            <button
              type="button"
              onClick={onBack}
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
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>E-mail</label>
              <div style={{ position: "relative", marginTop: 6 }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 6-10 7L2 6" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite seu e-mail"
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
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>

            <button
              type="button"
              onClick={onBack}
              style={{
                padding: 0,
                border: "none",
                background: "transparent",
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
