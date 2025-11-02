import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import EndGame from './pages/EndGame';

const App = () => {
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
