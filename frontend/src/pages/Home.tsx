import React, { useState } from 'react';
import socket from '../utils/socket';

const Home = () => {
  const [playerName, setPlayerName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [showJoinLobby, setShowJoinLobby] = useState(false);

  const createLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de créer un salon.');
      return;
    }

    socket.emit('createLobby', { player: { name: playerName } });
    socket.on('lobbyCreated', (data) => {
      console.log(`Salon créé avec le code : ${data.lobbyCode}`);
      // Logique pour rediriger vers la page du lobby
    });
  };

  const joinLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de rejoindre un salon.');
      return;
    }
    if (!lobbyCode.trim()) {
      alert('Veuillez entrer un code de lobby valide.');
      return;
    }

    socket.emit('joinLobby', { lobbyCode, player: { name: playerName } });
    socket.on('playerJoined', (data) => {
      console.log(`Joueur ajouté au salon : ${data.players.map((p: { name: any; }) => p.name).join(', ')}`);
      // Logique pour rediriger vers la page du lobby
    });
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Bienvenue sur le Jeu</h1>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="playerName">Votre nom : </label>
        <input
          id="playerName"
          type="text"
          placeholder="Entrez votre nom"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
      </div>

      <button onClick={createLobby} style={{ margin: '10px' }}>
        Créer un salon
      </button>

      <button onClick={() => setShowJoinLobby(!showJoinLobby)} style={{ margin: '10px' }}>
        Rejoindre un salon
      </button>

      {showJoinLobby && (
        <div style={{ marginTop: '20px' }}>
          <label htmlFor="lobbyCode">Code du salon : </label>
          <input
            id="lobbyCode"
            type="text"
            placeholder="Entrez le code du salon"
            value={lobbyCode}
            onChange={(e) => setLobbyCode(e.target.value)}
          />
          <button onClick={joinLobby} style={{ marginLeft: '10px' }}>
            Rejoindre
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
