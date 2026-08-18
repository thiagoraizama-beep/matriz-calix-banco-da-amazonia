import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getPublicAvatar } from "../api/client.js";
import Avatar from "../components/common/Avatar.jsx";
import ForgotPasswordPage from "./ForgotPasswordPage.jsx";

// Marca se o app ja "bootou" nesta vida do processo JS. Um reload real (F5)
// reinicia o modulo e essa flag volta a false, entao os campos salvos sao
// descartados; um logout sem reload mantem a flag true e preserva os campos.
let appBooted = false;

const CREDENTIALS_STORAGE_KEY = "login-draft-credentials";

export default function LoginPage() {
  const { login } = useAuth();

  if (!appBooted) {
    sessionStorage.removeItem(CREDENTIALS_STORAGE_KEY);
    appBooted = true;
  }

  const savedCredentials = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(CREDENTIALS_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const [email, setEmailState] = useState(savedCredentials.email || "");
  const [senha, setSenhaState] = useState(savedCredentials.senha || "");

  function setEmail(value) {
    setEmailState(value);
    sessionStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ email: value, senha }));
  }

  function setSenha(value) {
    setSenhaState(value);
    sessionStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify({ email, senha: value }));
  }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const debounceRef = useRef(null);

  const lastSessionAt = Number(localStorage.getItem("lastSessionAt") || 0);
  const isRecentSession = lastSessionAt > 0 && Date.now() - lastSessionAt < 30 * 60 * 1000;

  const isFirstRun = useRef(true);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!email.includes("@")) {
      setAvatar(null);
      setAvatarLoading(false);
      return;
    }
    const delay = isFirstRun.current ? 0 : 400;
    isFirstRun.current = false;
    setAvatarLoading(true);
    debounceRef.current = setTimeout(() => {
      getPublicAvatar(email)
        .then(setAvatar)
        .catch(() => setAvatar(null))
        .finally(() => setAvatarLoading(false));
    }, delay);
    return () => clearTimeout(debounceRef.current);
  }, [email]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, senha);
    } catch {
      setError("Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  if (showForgotPassword) {
    return <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />;
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
        background: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('/pexels-christopher-borges-1300281899-24710600.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: 16,
      }}
    >
      <div className="login-form-wrap" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 16px" }}>
            {avatarLoading ? (
              <div className="skeleton" style={{ width: 56, height: 56, borderRadius: "50%" }} />
            ) : avatar?.nome ? (
              <Avatar nome={avatar.nome} fotoUrl={avatar.fotoUrl} size={56} />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#fff" }}>
            {avatarLoading
              ? " "
              : isRecentSession && avatar?.nome
              ? `Bem-vindo de volta, ${avatar.nome.split(" ")[0]}`
              : "Bem-vindo"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, margin: "8px 0 0" }}>Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="on" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                {avatarLoading ? (
                  <div className="skeleton" style={{ width: 18, height: 18, borderRadius: "50%" }} />
                ) : avatar?.nome ? (
                  <Avatar nome={avatar.nome} fotoUrl={avatar.fotoUrl} size={18} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 6-10 7L2 6" />
                  </svg>
                )}
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                required
                className="login-input"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Senha</label>
            <div style={{ position: "relative", marginTop: 6 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.75)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showSenha ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="login-input"
                style={{ ...inputStyle, padding: "10px 38px 10px 38px" }}
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
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Esqueceu a senha?
          </button>
        </form>
      </div>

      <div
        className="login-logos"
        style={{
          position: "absolute",
          right: 56,
          bottom: 32,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <img src="/RGB_logo_horizontal_branco.png" alt="Banco da Amazônia" className="login-logo-senado" style={{ height: 34, objectFit: "contain" }} />
        <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.35)" }} />
        <img src="/CLX_branco.png" alt="Cálix" className="login-logo-calix" style={{ height: 30, objectFit: "contain" }} />
      </div>
    </div>
  );
}
