import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socket from '../utils/socket'; // Ton instance de socket.io
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import Footer from '../components/Footer';
import { BsFillCaretLeftFill } from "react-icons/bs";
import PlayerCard from '../components/PlayerCard';

export interface IPlayer {
    id: string;
    socketId: string;
    name: string;
    isHost: boolean;
    score?: number;
}

const Lobby = () => {
    const { lobbyCode } = useParams();
    const [playerName] = useState<string>(() => {
        // D'abord vérifier l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlPlayerName = urlParams.get('playerName');

        // Si trouvé dans l'URL, le sauvegarder
        if (urlPlayerName) {
            localStorage.setItem(`playerName_${lobbyCode}`, urlPlayerName);
            return urlPlayerName;
        }

        // Sinon, récupérer depuis localStorage
        const savedPlayerName = localStorage.getItem(`playerName_${lobbyCode}`);
        if (savedPlayerName) {
            return savedPlayerName;
        }

        // Dernier recours: générer un nom aléatoire
        const randomName = `Joueur${Math.floor(Math.random() * 1000)}`;
        localStorage.setItem(`playerName_${lobbyCode}`, randomName);
        return randomName;
    });
    const navigate = useNavigate();
    const [players, setPlayers] = useState<IPlayer[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<IPlayer>();

    const generateLink = () => {
        const link = `${window.location.origin}/?lobbyCode=${lobbyCode}`;
        document.getElementById("inviteLinkMessage")!.style.visibility = "visible";
        navigator.clipboard.writeText(link) // Copie le lien dans le presse-papiers
            .then(() => {
                console.log('Lien copié dans le presse-papiers :', link);
            })
            .catch((error) => {
                console.error('Erreur lors de la copie du lien :', error);
            });
        setTimeout(() => {
            document.getElementById("inviteLinkMessage")!.style.visibility = "hidden";
        }, 2000);
    }

    const leaveLobby = () => {
        console.log('Quitter le salon', currentPlayer?.id);
        socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer?.id });
        navigate('/');
    }

    const kickPlayer = (playerId: string) => {
        console.log('Kick player: ', playerId);
        socket.emit('kickPlayer', { lobbyCode, playerId });
    }

    const promotePlayer = (playerId: string) => {
        console.log('Promote player: ', playerId);
        socket.emit('promotePlayer', { lobbyCode, playerId });
    }

    window.onbeforeunload = () => {
        console.log('Quitter le salon', currentPlayer?.id);
        socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer?.id });
    };

    useEffect(() => {
        // Flag pour éviter les navigations parasites pendant le montage
        let justJoined = true;
        setTimeout(() => { justJoined = false; }, 1000);

        // Rejoindre le lobby une seule fois au montage du composant
        socket.emit('joinLobby', { lobbyCode, playerName });

        // Écouter les événements socket
        const handleUpdatePlayersList = (data: { players: IPlayer[] }) => {
            console.log('updatePlayersList', data.players);
            setPlayers(data.players);
            const potentialCurrentPlayer = data.players.find((p: IPlayer) => p.socketId === socket.id);
            if (potentialCurrentPlayer) {
                console.log('Recovered current player:', potentialCurrentPlayer);
                setCurrentPlayer(potentialCurrentPlayer);
            } else {
                console.warn('Could not find current player in the players list');
            }
        };

        const handleJoinedLobby = (data: { player: IPlayer }) => {
            console.log('joinedLobby', data.player);
            setCurrentPlayer(data.player);
            // Demander la liste complète des joueurs
            // (elle sera envoyée via updatePlayersList par le serveur)
        };

        const handleKickedFromLobby = () => {
            console.log('Kicked from lobby');
            alert('Vous avez été expulsé du salon.');
            navigate('/');
        };

        const handleError = (data: { message: string }) => {
            // Ignorer les erreurs "Lobby not found" pendant la première seconde (React StrictMode)
            if (justJoined && data.message === 'Lobby not found') {
                console.log('Ignoring "Lobby not found" error during mount');
                return;
            }

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
        };

        const handleGameStarted = (data: any) => {
            console.log('Game started, navigating to game page');
            // Sauvegarder le joueur actuel dans localStorage
            // On utilise les données les plus récentes du serveur
            setCurrentPlayer(prev => {
                if (prev) {
                    localStorage.setItem('currentPlayer', JSON.stringify(prev));
                }
                return prev;
            });
            navigate(`/game/${lobbyCode}`);
        };

        socket.on('updatePlayersList', handleUpdatePlayersList);
        socket.on('joinedLobby', handleJoinedLobby);
        socket.on('kickedFromLobby', handleKickedFromLobby);
        socket.on('error', handleError);
        socket.on('gameStarted', handleGameStarted);

        return () => {
            socket.off('updatePlayersList', handleUpdatePlayersList);
            socket.off('joinedLobby', handleJoinedLobby);
            socket.off('kickedFromLobby', handleKickedFromLobby);
            socket.off('error', handleError);
            socket.off('gameStarted', handleGameStarted);
        };
    }, [lobbyCode, playerName, navigate]);

    return (
        <div className="container">
            <div className="col-12">
                <Logo size="small" />
            </div>
            <div className='col-3'></div>
            <div className="col-6">
                <Frame>
                    <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', alignSelf: 'flex-start' }} onClick={leaveLobby}>
                        <span style={{ display: 'flex', alignItems: 'center', marginRight: 6 }}>
                            {BsFillCaretLeftFill({ size: 15 }) as JSX.Element}
                        </span>
                        <span>Quitter</span>
                    </div>
                    <h3 style={{ margin: 0 }}>Nombre de joueurs {players.length}/20</h3>
                    <ul style={{ listStyle: "none", width: "100%", margin: 0, padding: 0 }}>
                        {players.map((player) => (
                            <li key={player.id}>
                                <PlayerCard
                                    id={player.id}
                                    name={player.name}
                                    isHost={player.isHost}
                                    isCurrentPlayer={currentPlayer?.id === player.id}
                                    currentPlayerIsHost={!!currentPlayer?.isHost}
                                    onKick={(id) => kickPlayer(id)}
                                    onPromote={(id) => promotePlayer(id)}
                                />
                            </li>
                        ))}
                    </ul>
                    <div style={{ display: 'flex', gap: '100px', alignItems: 'center' }}>
                        {currentPlayer?.isHost && (players.length >= 3 ? (
                            <Button
                                text="Lancer le jeu"
                                backgroundColor="#30c94d"
                                rotateEffect="true"
                                onClick={() => socket.emit('startGame', { lobbyCode })}
                            />
                        ) : (
                            <Button
                                text="Lancer le jeu"
                                backgroundColor="#30c94d"
                                rotateEffect="true"
                                state='disabled'
                                onClick={() => {}}
                            />
                        ))}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <small>
                                Code du salon : <b>{lobbyCode}</b>
                            </small>
                            <Button text="Lien d'invitation" backgroundColor="#FFC700" onClick={generateLink} />
                            <small id="inviteLinkMessage" style={{ visibility: 'hidden', color: 'grey' }}><i>Lien copié !</i></small>
                        </div>
                    </div>
                </Frame>
            </div>
            <div className='col-3'></div>
            <div className="col-12">
                <Footer />
            </div>  
        </div>
    );
};

export default Lobby;
