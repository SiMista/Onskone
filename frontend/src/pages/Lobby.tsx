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

  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

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
    console.log('Quitter le salon', currentPlayerId);
    socket.emit('leaveLobby', { lobbyCode, currentPlayerId });
    navigate('/');
  }

  useEffect(() => {
    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      socket.emit('leaveLobby', { lobbyCode, currentPlayerId });
    });
  }, []);

  useEffect(() => {
    // Charger les joueurs existants au début
    socket.emit('getLobbyPlayers', { lobbyCode });

    // Écouter l'événement de mise à jour des joueurs
    socket.on('updatePlayersList', (data) => {
      setPlayers(data.players);
    });

    socket.on('joinedLobby', (data) => {
      setCurrentPlayerId(data.playerId);
      localStorage.setItem('currentPlayerId', data.playerId);
    });
  
    // Ajouter l'événement avant de quitter la page
    //window.addEventListener('beforeunload', handleBeforeUnload);


    // Nettoyer les écouteurs pour éviter les doublons
    return () => {
      socket.off('joinedLobby');
      socket.off('updatePlayersList');
      // window.removeEventListener('beforeunload', handleBeforeUnload);
      // localStorage.removeItem('currentPlayerId');
    };
  }, [lobbyCode]); // Ce useEffect se déclenche à chaque changement de lobbyCode


  return (
    <div>
      <h1>Salon</h1>
      <h2>Bienvenue dans le salon {lobbyCode}</h2>
      <h3>Joueurs dans le salon :</h3>
      <p>Vous êtes {currentPlayerId}</p>
      <ul>
        {players.map((player) => {
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
