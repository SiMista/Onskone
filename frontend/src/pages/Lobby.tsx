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
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('playerName') || '';
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
        socket.emit('joinLobby', { lobbyCode, playerName });

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

        socket.on('kickedFromLobby', (data) => {
            console.log('Kicked from lobby:', data);
            alert('Vous avez été expulsé du salon.');
            navigate('/');
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
                    <h3>Nombre de joueurs {players.length}/20</h3>
                    <ul style={{ listStyle: "none", width: "100%", padding: 0 }}>
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
                        {currentPlayer?.isHost && (
                            <Button text="Lancer le jeu" backgroundColor="#30c94d" rotateEffect="true" onClick={() => console.log('Lancer le jeu')} />
                        )}
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
            <Footer />
        </div>
    );
};

export default Lobby;
