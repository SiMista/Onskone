import { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import EndGame from './pages/EndGame';
import { initSounds } from './utils/sounds';

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
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:lobbyCode" element={<Lobby />} />
        <Route path="/game/:lobbyCode" element={<Game />} />
        <Route path="/endgame/:lobbyCode" element={<EndGame />} />
      </Routes>
    </Router>
  );
};

export default App;
