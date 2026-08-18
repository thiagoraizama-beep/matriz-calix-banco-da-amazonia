import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { MatrixFiltersProvider } from "./context/MatrixFiltersContext.jsx";
import { CampanhasHomeFiltersProvider } from "./context/CampanhasHomeFiltersContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar, {
  useSidebarCollapsed,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
  PAGES,
} from "./components/layout/Sidebar.jsx";
import TopNav, { TOPNAV_HEIGHT } from "./components/layout/TopNav.jsx";

// Flag temporaria para testar o layout de navegacao superior (top nav) no lugar da
// sidebar lateral. Trocar para false reverte imediatamente para a sidebar original.
const USE_TOP_NAV = true;
import { getCampanhas } from "./api/client.js";
import { campanhasComAnalise } from "./utils/creativeAnalysisScope.js";
import ContentMatrixPage from "./pages/ContentMatrixPage.jsx";
import CampanhasHomePage from "./pages/CampanhasHomePage.jsx";
import CriativosAImplementarPage from "./pages/CriativosAImplementarPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import PageLoader from "./components/common/PageLoader.jsx";
import Footer from "./components/layout/Footer.jsx";
import MobileTopBar from "./components/layout/MobileTopBar.jsx";
import useIsMobile from "./hooks/useIsMobile.js";
import { MobileNavProvider } from "./context/MobileNavContext.jsx";

const PAGE_LOAD_DELAY_MS = 600;
const PAGES_WITH_OWN_TOPBAR = [PAGES.MATRIZ_CONTEUDO];

// Slugs de URL (ASCII, sem acento) para cada pagina de nivel superior -- a label em
// PAGES continua sendo a fonte usada para exibicao/comparacao no TopNav/Sidebar,
// so a URL passa a ser a fonte de verdade de "em qual pagina o usuario esta".
const PAGE_PATHS = {
  [PAGES.MATRIZ_CONTEUDO]: "/matriz-de-conteudo",
  [PAGES.A_IMPLEMENTAR]: "/a-implementar",
  [PAGES.PERFIL]: "/perfil",
};

function pageFromPath(pathname) {
  if (pathname.startsWith("/matriz-de-conteudo")) return PAGES.MATRIZ_CONTEUDO;
  if (pathname.startsWith("/a-implementar")) return PAGES.A_IMPLEMENTAR;
  if (pathname.startsWith("/perfil")) return PAGES.PERFIL;
  return PAGES.MATRIZ_CONTEUDO;
}

export default function AuthenticatedApp() {
  const { user, refreshUser } = useAuth();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = useMemo(() => pageFromPath(location.pathname), [location.pathname]);
  const [campanhas, setCampanhas] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const openMobileMenu = () => setMobileNavOpen(true);

  // Agencia/cliente nao tem escopos restritos -- a lista completa de campanhas (com
  // veiculos/plataformas) alimenta o Comparativo de Campanhas dentro da Matriz.
  function loadCampanhas() {
    if (user?.papel !== "veiculo" && user?.papel !== "parceiro") {
      getCampanhas().then(setCampanhas).catch(console.error);
    }
  }

  useEffect(() => {
    loadCampanhas();
  }, [user?.papel]);

  // Pontos sensiveis a escopo/permissao desatualizada: a agencia pode ter mudado o
  // vinculo do usuario (campanha, plataformas, acessoAnaliseCriativo/acessoMatriz)
  // enquanto ele ja estava logado, ou editado status/dados da campanha em Perfil --
  // recarrega ao entrar na Matriz para nao mostrar dado desatualizado.
  useEffect(() => {
    if (activePage === PAGES.MATRIZ_CONTEUDO) {
      refreshUser().catch(() => {});
      loadCampanhas();
    }
  }, [activePage]);

  // "A implementar" funciona como toggle: clicar de novo enquanto ja esta nela
  // fecha a aba e volta para a pagina de onde o usuario veio (via historico do
  // navegador), em vez de sempre reabrir/permanecer nela -- diferente das demais
  // paginas de nivel superior, que sao navegacao normal (sempre vai para o destino).
  // Se nao houver de onde voltar (ex: usuario abriu /a-implementar direto na URL,
  // sem navegacao anterior dentro do app), cai no fallback de ir para a Matriz.
  function handleNavigate(page) {
    if (page === PAGES.A_IMPLEMENTAR && activePage === PAGES.A_IMPLEMENTAR) {
      if (window.history.length > 1) navigate(-1);
      else navigate(PAGE_PATHS[PAGES.MATRIZ_CONTEUDO]);
      return;
    }
    navigate(PAGE_PATHS[page]);
  }

  useEffect(() => {
    setPageLoading(true);
    const timer = setTimeout(() => setPageLoading(false), PAGE_LOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <ThemeProvider>
      <MatrixFiltersProvider>
        <CampanhasHomeFiltersProvider>
          <MobileNavProvider openMobileMenu={openMobileMenu}>
            <AppShell
              user={user}
              collapsed={collapsed}
              toggleCollapsed={toggleCollapsed}
              activePage={activePage}
              handleNavigate={handleNavigate}
              campanhas={campanhas}
              mobileNavOpen={mobileNavOpen}
              setMobileNavOpen={setMobileNavOpen}
              isMobile={isMobile}
              sidebarWidth={sidebarWidth}
              pageLoading={pageLoading}
              openMobileMenu={openMobileMenu}
            />
          </MobileNavProvider>
        </CampanhasHomeFiltersProvider>
      </MatrixFiltersProvider>
    </ThemeProvider>
  );
}

// Le campanhaId da URL para abrir a Matriz de uma campanha especifica (nao mostra
// mais todos os criativos do sistema de uma vez -- so os desta campanha). Se o id
// nao bater com nenhuma campanha visivel (link velho/invalido), volta pra Home.
function MatrizDrillIn({ campanhas }) {
  const { campanhaId } = useParams();
  const existe = campanhas.length === 0 || campanhas.some((c) => String(c.id) === campanhaId);
  if (!existe) return <Navigate to="/matriz-de-conteudo" replace />;
  return <ContentMatrixPage campanhaId={campanhaId} />;
}

function AppShell({
  user, collapsed, toggleCollapsed, activePage, handleNavigate, campanhas,
  mobileNavOpen, setMobileNavOpen, isMobile, sidebarWidth, pageLoading, openMobileMenu,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const campanhasParaAnalise = useMemo(() => campanhasComAnalise(user, campanhas), [user, campanhas]);
  const dentroDeCampanha = activePage === PAGES.MATRIZ_CONTEUDO && location.pathname !== "/matriz-de-conteudo";
  const showMatrixFilters = USE_TOP_NAV && !isMobile && dentroDeCampanha;
  const showCampanhasFilters = USE_TOP_NAV && !isMobile && activePage === PAGES.MATRIZ_CONTEUDO && !dentroDeCampanha;
  const showVoltar = dentroDeCampanha || activePage === PAGES.A_IMPLEMENTAR;
  const topOffset = !isMobile && USE_TOP_NAV ? TOPNAV_HEIGHT : 0;

  return (
    <>
      {pageLoading && <PageLoader pageName={activePage} />}
      {USE_TOP_NAV && !isMobile && (
        <TopNav
          activePage={activePage}
          onNavigate={handleNavigate}
          user={user}
          showMatrixFilters={showMatrixFilters}
          showCampanhasFilters={showCampanhasFilters}
          showVoltar={showVoltar}
          onVoltar={() => navigate("/matriz-de-conteudo")}
        />
      )}
      {(!USE_TOP_NAV || isMobile) && (
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          activePage={activePage}
          onNavigate={handleNavigate}
          user={user}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
      )}
      <div
        style={{
          marginLeft: isMobile || USE_TOP_NAV ? 0 : sidebarWidth,
          marginTop: topOffset,
          transition: "margin-left 0.2s ease",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isMobile && !PAGES_WITH_OWN_TOPBAR.includes(activePage) && <MobileTopBar onOpenMenu={openMobileMenu} />}
        <div className="app-shell" style={{ flex: 1, paddingTop: isMobile ? 56 : undefined }}>
          <Routes>
            <Route index element={<Navigate to="/matriz-de-conteudo" replace />} />
            <Route path="matriz-de-conteudo" element={<CampanhasHomePage campanhasParaAnalise={campanhasParaAnalise} />} />
            <Route path="matriz-de-conteudo/:campanhaId" element={<MatrizDrillIn campanhas={campanhas} />} />
            <Route path="a-implementar" element={<CriativosAImplementarPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/matriz-de-conteudo" replace />} />
          </Routes>
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <Footer />
        </div>
      </div>
    </>
  );
}
