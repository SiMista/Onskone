import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socket from '../utils/socket';

const Home = () => {
  const [playerName, setPlayerName] = useState<string>(() => {
    const randomName = `Joueur${Math.floor(Math.random() * 1000)}`; // TODO ONLY FOR DEVMODE !
    return randomName;
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const lobbyCode = searchParams.get('lobbyCode');

  const createLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de créer un salon.');
      return;
    }

    socket.emit('createLobby');
    socket.on('lobbyCreated', (data) => {
      console.log(`Salon créé avec le code : ${data.lobbyCode}`);
      console.log(`Joueur ajouté au salon : ${data.playerName}`);
      navigate(`/lobby/${data.lobbyCode}?playerName=${playerName}`);
    });
  };

  const joinLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de rejoindre un salon.');
      return;
    }

    navigate(`/lobby/${lobbyCode}?playerName=${playerName}`);

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
