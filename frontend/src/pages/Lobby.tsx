import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import Footer from '../components/Footer';
import { BsFillCaretLeftFill } from "react-icons/bs";
import PlayerCard from '../components/PlayerCard';
import { IPlayer } from '@onskone/shared';
import { useSocketEvent, useQueryParams, useLeavePrompt } from '../hooks';
import { GAME_CONFIG } from '../constants/game';

const Lobby = () => {
    const { lobbyCode } = useParams<{ lobbyCode: string }>();
    const queryParams = useQueryParams();
    const navigate = useNavigate();

    // Redirect if no lobby code
    useEffect(() => {
        if (!lobbyCode) {
            navigate('/');
        }
    }, [lobbyCode, navigate]);

    const [players, setPlayers] = useState<IPlayer[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
    const [showCopiedMessage, setShowCopiedMessage] = useState(false);
    const [playerName] = useState<string>(() => {
        // D'abord vérifier l'URL
        const urlPlayerName = queryParams.get('playerName');

        // Si trouvé dans l'URL, le sauvegarder
        if (urlPlayerName) {
            try {
                localStorage.setItem(`playerName_${lobbyCode}`, urlPlayerName);
            } catch (error) {
                console.error('Failed to save player name:', error);
            }
            return urlPlayerName;
        }

        // Sinon, récupérer depuis localStorage
        try {
            const savedPlayerName = localStorage.getItem(`playerName_${lobbyCode}`);
            if (savedPlayerName) {
                return savedPlayerName;
            }
        } catch (error) {
            console.error('Failed to load player name:', error);
        }

        // Dernier recours: générer un nom aléatoire
        const randomName = `Joueur${Math.floor(Math.random() * 1000)}`;
        try {
            localStorage.setItem(`playerName_${lobbyCode}`, randomName);
        } catch (error) {
            console.error('Failed to save generated player name:', error);
        }
        return randomName;
    });

    // Warn user before leaving
    useLeavePrompt(
        () => {
            if (currentPlayer && lobbyCode) {
                socket.emit('leaveLobby', { lobbyCode: lobbyCode!, currentPlayerId: currentPlayer.id });
            }
        },
        !!currentPlayer
    );

    const generateLink = useCallback(() => {
        const link = `${window.location.origin}/?lobbyCode=${lobbyCode!}`;
        navigator.clipboard.writeText(link)
            .then(() => {
                setShowCopiedMessage(true);
                setTimeout(() => setShowCopiedMessage(false), GAME_CONFIG.COPIED_MESSAGE_DURATION);
            })
            .catch((error) => {
                console.error('Erreur lors de la copie du lien :', error);
            });
    }, [lobbyCode]);

    const leaveLobby = useCallback(() => {
        if (currentPlayer && lobbyCode) {
            socket.emit('leaveLobby', { lobbyCode: lobbyCode!, currentPlayerId: currentPlayer.id });
        }
        navigate('/');
    }, [currentPlayer, lobbyCode, navigate]);

    const kickPlayer = useCallback((playerId: string) => {
        if (lobbyCode) {
            socket.emit('kickPlayer', { lobbyCode: lobbyCode!, playerId });
        }
    }, [lobbyCode]);

    const promotePlayer = useCallback((playerId: string) => {
        if (lobbyCode) {
            socket.emit('promotePlayer', { lobbyCode: lobbyCode!, playerId });
        }
    }, [lobbyCode]);

    const startGame = useCallback(() => {
        if (lobbyCode) {
            socket.emit('startGame', { lobbyCode: lobbyCode! });
        }
    }, [lobbyCode]);

    // Join lobby on mount
    useEffect(() => {
        if (lobbyCode && playerName) {
            socket.emit('joinLobby', { lobbyCode: lobbyCode!, playerName });
        }
    }, [lobbyCode, playerName]);

    // Socket event handlers
    const handleUpdatePlayersList = useCallback((data: { players: IPlayer[] }) => {
        setPlayers(data.players);
        const potentialCurrentPlayer = data.players.find((p: IPlayer) => p.socketId === socket.id);
        if (potentialCurrentPlayer) {
            setCurrentPlayer(potentialCurrentPlayer);
        }
    }, []);

    const handleJoinedLobby = useCallback((data: { player: IPlayer }) => {
        setCurrentPlayer(data.player);
    }, []);

    const handleKickedFromLobby = useCallback(() => {
        alert('Vous avez été expulsé du salon.');
        navigate('/');
    }, [navigate]);

    const handleError = useCallback((data: { message: string }) => {
        switch (data.message) {
            case 'Lobby not found':
            case 'Player not found':
                navigate('/');
                break;
            default:
                console.error('Error:', data.message);
        }
    }, [navigate]);

    const handleGameStarted = useCallback(() => {
        // Save current player to localStorage
        if (currentPlayer) {
            try {
                localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
            } catch (error) {
                console.error('Failed to save current player:', error);
            }
        }
        navigate(`/game/${lobbyCode}`);
    }, [currentPlayer, lobbyCode, navigate]);

    // Use custom socket hooks
    useSocketEvent('updatePlayersList', handleUpdatePlayersList, [handleUpdatePlayersList]);
    useSocketEvent('joinedLobby', handleJoinedLobby, [handleJoinedLobby]);
    useSocketEvent('kickedFromLobby', handleKickedFromLobby, [handleKickedFromLobby]);
    useSocketEvent('error', handleError, [handleError]);
    useSocketEvent('gameStarted', handleGameStarted, [handleGameStarted]);

    const activePlayers = players.filter(p => p.isActive);
    const canStartGame = activePlayers.length >= GAME_CONFIG.MIN_PLAYERS;

    return (
        <div className="container">
            <div className="col-12">
                <Logo size="small" />
            </div>
            <div className='col-3'></div>
            <div className="col-6">
                <Frame>
                    <div className="flex items-center cursor-pointer self-start" onClick={leaveLobby}>
                        <span className="flex items-center mr-1.5">
                            <BsFillCaretLeftFill size={15} />
                        </span>
                        <span>Quitter</span>
                    </div>
                    <div className="flex items-baseline gap-2 justify-center">
                        <h3 className="m-0 font-bold text-center">
                            Nombre de joueurs {activePlayers.length}/{GAME_CONFIG.MAX_PLAYERS}
                        </h3>
                        <span className="text-sm text-gray-500 italic">
                            ({GAME_CONFIG.MIN_PLAYERS} joueurs minimum)
                        </span>
                    </div>
                    <ul className="list-none w-full m-0 p-0">
                        {players.map((player) => (
                            <li key={player.id}>
                                <PlayerCard
                                    id={player.id}
                                    name={player.name}
                                    isHost={player.isHost}
                                    isCurrentPlayer={currentPlayer?.id === player.id}
                                    currentPlayerIsHost={!!currentPlayer?.isHost}
                                    isActive={player.isActive}
                                    onKick={kickPlayer}
                                    onPromote={promotePlayer}
                                />
                            </li>
                        ))}
                    </ul>
                    <div className="flex gap-[100px] items-center">
                        {currentPlayer?.isHost && (
                            <Button
                                text="Lancer le jeu"
                                variant='success'
                                size='md'
                                rotateEffect={true}
                                state={canStartGame ? 'default' : 'disabled'}
                                onClick={startGame}
                            />
                        )}
                        <div className="flex flex-col gap-1">
                            <small>
                                Code du salon : <b>{lobbyCode}</b>
                            </small>
                            <Button text="Lien d'invitation" variant='warning' size='md' onClick={generateLink} />
                            <small className={`text-gray-500 ${showCopiedMessage ? 'visible' : 'invisible'}`}>
                                <i>Lien copié !</i>
                            </small>
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