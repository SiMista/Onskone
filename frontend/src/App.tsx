import { useEffect, useRef, lazy, Suspense, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import EndGame from './pages/EndGame';
import NotFound from './pages/NotFound';
import Studio from './pages/Studio';
import { initSounds } from './utils/sounds';
import { ToastProvider } from './components/Toast';
import { LocaleProvider } from './i18n';

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

const App = () => {
  const soundsInitialized = useRef(false);

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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby/:lobbyCode" element={<Lobby />} />
            <Route path="/game/:lobbyCode" element={<Game />} />
            <Route path="/endgame/:lobbyCode" element={<EndGame />} />
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
        </AppShell>
      </Router>
      </LocaleProvider>
    </ToastProvider>
  );
};

export default App;
