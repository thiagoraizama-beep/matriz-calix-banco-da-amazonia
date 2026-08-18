import { Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import AuthenticatedApp from "./AuthenticatedApp.jsx";
import PageLoader from "./components/common/PageLoader.jsx";

function AppGate() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Link de recuperacao de senha vindo por e-mail: /redefinir-senha?token=...
          Funciona independente de estar logado ou nao, pois so exige o token valido. */}
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={loading ? <PageLoader pageName="Dashboard" /> : !user ? <LoginPage /> : <AuthenticatedApp />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
