import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socket from '../utils/socket'; // Ton instance de socket.io

const Lobby = () => {
  const { lobbyCode } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<{
    id: string; name: string; isHost: boolean; score: number
  }[]
  >([]);

  const generateLink = () => {
    const link = `${window.location.origin}/?lobbyCode=${lobbyCode}`;
    navigator.clipboard.writeText(link) // Copie le lien dans le presse-papiers
      .then(() => {
        console.log('Lien copié dans le presse-papiers :', link);
      })
      .catch((error) => {
        console.error('Erreur lors de la copie du lien :', error);
      });
  }

  const leaveLobby = () => {
    const playerId = localStorage.getItem('currentPlayerId');
    console.log(playerId);
    socket.emit('leaveLobby', { lobbyCode, playerId });
    localStorage.removeItem('currentPlayerId');
    navigate('/');
  }

  useEffect(() => {
    // Charger les joueurs existants au début (lorsque l'utilisateur entre dans le lobby)
    socket.emit('getLobbyPlayers', { lobbyCode });

    // Écouter l'événement de mise à jour des joueurs (lorsqu'un joueur rejoint)
    socket.on('playerJoined', (data) => {
      setPlayers(data.players);
    });

    socket.on('playerLeft', (data) => {
      setPlayers(data.players);
    });

    socket.on('joinedLobby', (data) => {
      localStorage.setItem('currentPlayerId', data.playerId)
      const playerId = localStorage.getItem('currentPlayerId');

      console.log(playerId);
    });

    // Nettoyer les écouteurs pour éviter les doublons
    return () => {
      socket.off('playerJoined');
      socket.off('playerLeft');
    };
  }, [lobbyCode]); // Ce useEffect se déclenche à chaque changement de lobbyCode


  return (
    <div>
      <h1>Salon</h1>
      <h2>Bienvenue dans le salon {lobbyCode}</h2>
      <h3>Joueurs dans le salon :</h3>
      <ul>
        {players.map((player) => {
          const currentPlayerId = localStorage.getItem('currentPlayerId');
          const isCurrentPlayer = currentPlayerId === player.id;

          return (
            <li key={player.id} style={{ color: isCurrentPlayer ? 'red' : 'black' }}>
              {player.name} {player.isHost && '(Hôte)'}
            </li>
          );
        })}
      </ul>
      <button onClick={generateLink}>Lien d'invitation</button>
      <button onClick={leaveLobby}>Quitter le salon</button>
    </div>
  );
};

export default Lobby;
