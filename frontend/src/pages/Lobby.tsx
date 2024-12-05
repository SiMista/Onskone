import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../utils/socket'; // Ton instance de socket.io

const Lobby = () => {
  const { lobbyCode } = useParams();
  const [players, setPlayers] = useState<{ 
    id: string; name: string; isHost: boolean; score: number }[]
    >([]);

useEffect(() => {
    // Charger les joueurs existants au début (lorsque l'utilisateur entre dans le lobby)
    socket.emit('getLobbyPlayers', { lobbyCode });

    // Écouter l'événement de mise à jour des joueurs (lorsqu'un joueur rejoint)
    socket.on('playerJoined', (data: { players: { id: string; name: string; isHost: boolean; score: number }[] }) => {
        setPlayers(data.players); // Mettre à jour la liste des joueurs
    });

    // Nettoyer les écouteurs pour éviter les doublons
    return () => {
        socket.off('playerJoined');
    };
    }, [lobbyCode]); // Ce useEffect se déclenche à chaque changement de lobbyCode


  return (
    <div>
      <h1>Salon</h1>
      <h2>Bienvenue dans le salon {lobbyCode}</h2>
      <h3>Joueurs dans le salon :</h3>
      <ul>
        {players.map((player) => (
            <li key={player.id}>
            {player.name} {player.isHost && '(Hôte)'}
            </li>
        ))}
        </ul>
    </div>
  );
};

export default Lobby;
