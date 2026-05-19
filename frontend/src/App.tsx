import { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import EndGame from './pages/EndGame';
import NotFound from './pages/NotFound';
import Studio from './pages/Studio';
import { initSounds } from './utils/sounds';
import { ToastProvider } from './components/Toast';

const Admin = lazy(() => import('./pages/Admin'));

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
      <Router>
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
      </Router>
    </ToastProvider>
  );
};

export default App;
