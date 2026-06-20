import { useEffect, useRef, lazy, Suspense, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import Studio from './pages/Studio';
import Legal from './pages/Legal';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { initSounds } from './utils/sounds';
import { ToastProvider } from './components/Toast';
import { LocaleProvider } from './i18n';
import { extractLobbyCode } from './constants/game';

const Lobby = lazy(() => import('./pages/Lobby'));
const Game = lazy(() => import('./pages/Game'));
const EndGame = lazy(() => import('./pages/EndGame'));
const Admin = lazy(() => import('./pages/Admin'));

/* Le body est figé en h:100dvh + overflow:hidden côté CSS. Studio (multi-iframes
   dev only) et Admin ont besoin de scroll global - on libère les contraintes
   pendant qu'ils sont montés. */
const AppShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const allowGlobalScroll = pathname.startsWith('/studio') || pathname.startsWith('/admin');

  useEffect(() => {
    if (!allowGlobalScroll) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };
    html.style.overflow = 'visible';
    html.style.height = 'auto';
    body.style.overflow = 'visible';
    body.style.height = 'auto';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
    };
  }, [allowGlobalScroll]);

  // Wrapper toujours rendu en tant que <div> stable. En mode global-scroll
  // (studio/admin), display:contents le rend transparent au layout, sinon il
  // contraint l'app à la viewport. Évite un unmount complet de Routes au
  // changement d'allowGlobalScroll.
  return (
    <div className={allowGlobalScroll ? 'contents' : 'h-dvh w-full flex flex-col overflow-hidden'}>
      {children}
    </div>
  );
};

/* Lien d'invitation web : /join/<code> rebascule sur le flux de join (Home lit
   ?lobbyCode=). Garde une URL propre et matchable par les App/Universal Links. */
const JoinRedirect = () => {
  const { lobbyCode } = useParams();
  if (!lobbyCode) return <Navigate to="/" replace />;
  return <Navigate to={`/?lobbyCode=${encodeURIComponent(lobbyCode)}`} replace />;
};

/* Deep links natifs (App/Universal Links). Quand l'OS ouvre l'app via un lien
   onskone.fr, on en extrait le code de lobby et on route dessus :
   - cold start : `getLaunchUrl()` (l'URL qui a lancé l'app, sinon ratée car émise
     avant l'enregistrement du listener) ;
   - warm start : event `appUrlOpen` (app déjà en mémoire). */
const DeepLinkHandler = () => {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const route = (url: string) => {
      const code = extractLobbyCode(url);
      if (code) navigate(`/?lobbyCode=${encodeURIComponent(code)}`);
    };
    CapacitorApp.getLaunchUrl().then((res) => { if (res?.url) route(res.url); });
    const handle = CapacitorApp.addListener('appUrlOpen', ({ url }) => route(url));
    return () => { handle.then((h) => h.remove()); };
  }, [navigate]);
  return null;
};

const App = () => {
  const soundsInitialized = useRef(false);

  // Retire le splash AndroidX des que l'app React est montee (no-op sur web).
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide();
    }
  }, []);

  useEffect(() => {
    // Initialiser les sons au premier clic/touch utilisateur
    const handleFirstInteraction = () => {
      if (soundsInitialized.current) return;
      soundsInitialized.current = true;
      initSounds();
      // Retirer les listeners après initialisation
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  return (
    <ToastProvider>
      <LocaleProvider>
      <Router>
        <AppShell>
          <DeepLinkHandler />
          <Suspense fallback={<div />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/join/:lobbyCode" element={<JoinRedirect />} />
              <Route path="/lobby/:lobbyCode" element={<Lobby />} />
              <Route path="/game/:lobbyCode" element={<Game />} />
              <Route path="/endgame/:lobbyCode" element={<EndGame />} />
              <Route path="/privacy" element={<Legal kind="privacy" />} />
              <Route path="/mentions" element={<Legal kind="mentions" />} />
              <Route path="/support" element={<Legal kind="support" />} />
              {import.meta.env.DEV && <Route path="/studio" element={<Studio />} />}
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</div>}>
                    <Admin />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
      </Router>
      </LocaleProvider>
    </ToastProvider>
  );
};

export default App;
