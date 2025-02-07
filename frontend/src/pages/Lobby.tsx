import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import socket from '../utils/socket'; // Ton instance de socket.io

export interface IPlayer {
    id: string;
    socketId: string;
    name: string;
    isHost: boolean;
    score?: number;
}

const Lobby = () => {
    const {lobbyCode} = useParams();
    const [playerName] = useState<string>(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('playerName') || '';
    });
    const navigate = useNavigate();
    const [players, setPlayers] = useState<IPlayer[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<IPlayer>();

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
        console.log('Quitter le salon', currentPlayer?.id);
        socket.emit('leaveLobby', {lobbyCode, currentPlayerId: currentPlayer?.id});
        navigate('/');
    }

    window.onbeforeunload = () => {
        console.log('Quitter le salon', currentPlayer?.id);
        socket.emit('leaveLobby', {lobbyCode, currentPlayerId: currentPlayer?.id});
    };

    useEffect(() => {
        socket.emit('joinLobby', {lobbyCode, playerName});

        socket.on('updatePlayersList', (data) => {
            console.log('updatePlayersList', data.players);
            setPlayers(data.players);
            const potentialCurrentPlayer = data.players.find((p: IPlayer) => p.socketId === socket.id);
            if (potentialCurrentPlayer) {
                console.log('Recovered current player:', potentialCurrentPlayer);
                setCurrentPlayer(potentialCurrentPlayer);
            } else {
                console.warn('Could not find current player in the players list');
            }
        });

        socket.on('joinedLobby', (data) => {
            setCurrentPlayer(data.player);
        });

        socket.on('error', (data) => {
            switch (data.message) {
                case 'Lobby not found':
                    navigate('/');
                    break;
                case 'Player not found':
                    navigate('/');
                    break;
                default:
                    console.error('Error:', data.message);
            }
        });

        return () => {
            socket.off('updatePlayersList');
            socket.off('joinedLobby');
        }
    }, []);

    return (
        <div>
            <h1>Salon</h1>
            <h2>Bienvenue dans le salon {lobbyCode}</h2>
            <h3>Joueurs dans le salon :</h3>
            <p>Vous êtes {currentPlayer?.name}</p>
            <ul>
                {players.map((player) => {
                    const isCurrentPlayer = currentPlayer?.id === player.id;
                    return (
                        <li key={player.id} style={{color: isCurrentPlayer ? 'red' : 'black'}}>
                            {player.name} {player.isHost ? '(hôte)' : ''}
                        </li>
                    );
                })}
            </ul>
            <button onClick={generateLink}>Lien d'invitation</button>
            <button onClick={leaveLobby}>Quitter le salon</button>
            {currentPlayer?.isHost && (
                <button onClick={() => console.log('Lancer le jeu')}>Lancer le jeu</button>
            )}
        </div>
    );
};

export default Lobby;
