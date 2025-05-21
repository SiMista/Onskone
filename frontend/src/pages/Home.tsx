import React, { useEffect, useState } from 'react';
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
    socket.emit('createLobby', { playerName });
  };

  const joinLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de rejoindre un salon.');
      return;
    }
    socket.emit('checkPlayerName', { lobbyCode, playerName });
  };

  useEffect(() => {
    socket.on('lobbyCreated', (data) => {
      console.log(`Salon créé avec le code : ${data.lobbyCode}`);
      console.log(`Joueur ajouté au salon : ${data.playerName}`);
      navigate(`/lobby/${data.lobbyCode}?playerName=${playerName}`);
    });

    socket.on('playerNameExists', (data) => {
      console.log(`Le nom "${data.playerName}" est déjà utilisé dans le salon. Veuillez choisir un autre nom.`);
      alert(`Le nom "${data.playerName}" est déjà utilisé dans le salon. Veuillez choisir un autre nom.`);
    });

    socket.on('playerNameValid', () => {
      console.log(`Le nom "${playerName}" est valide.`);
      navigate(`/lobby/${lobbyCode}?playerName=${playerName}`);
    });

    socket.on('error', (data) => {
      console.error('Erreur:', data.message);
      alert(`Erreur: ${data.message}`);
    });

    return () => {
      socket.off('playerNameExists');
      socket.off('playerNameValid');
    };
  }, []);

  return (
    <div>
      <h1>Bienvenue sur le Jeu</h1>
      <div>
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
        <div>
          <button onClick={createLobby}>
            Créer un salon
          </button>
        </div>
      ) : (
        <div>
          <p>Vous êtes invité à rejoindre le salon {lobbyCode}</p>
          <button onClick={joinLobby}>
            Rejoindre
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
