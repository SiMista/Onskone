import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import socket from './utils/socket';

const App = () => {  
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/lobby/:lobbyCode" element={<Lobby/>} />
      </Routes>
    </Router>
  );
};

export default App;
