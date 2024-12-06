import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socket from '../utils/socket';

const Home = () => {
  const [playerName, setPlayerName] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const lobbyCode = searchParams.get('lobbyCode'); // Vérifie si un code est passé dans l'URL

  const createLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de créer un salon.');
      return;
    }

    socket.emit('createLobby', { playerName: playerName });
    socket.on('lobbyCreated', (data) => {
      console.log(`Salon créé avec le code : ${data.lobbyCode}`);
      console.log(`Joueur ajouté au salon : ${data.playerName}`);
      navigate(`/lobby/${data.lobbyCode}`);
    });
  };

  const joinLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de rejoindre un salon.');
      return;
    }

    socket.emit('joinLobby', { lobbyCode, playerName });

    socket.on('playerJoined', (data) => {
      console.log(`Joueur ajouté au salon : ${data.players.map((p: { name: any; }) => p.name).join(', ')}`);
      navigate(`/lobby/${lobbyCode}`);
    });

    // Écoute des erreurs du serveur
    socket.on('error', (data) => {
      console.error('Error from server:', data.message);
      alert('Error joining lobby: ' + data.message);
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



      {!lobbyCode ? (
        <button onClick={createLobby} style={{ margin: '10px' }}>
          Créer un salon
        </button>
      ) : (
        <div>
          <p>Vous êtes invité à rejoindre le salon {lobbyCode}</p>
          <button onClick={joinLobby} style={{ marginLeft: '10px' }}>
            Rejoindre
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
