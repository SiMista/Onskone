import { useEffect, useState, useCallback, useRef } from 'react';
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
import { GAME_CONFIG, AVATARS } from '../constants/game';

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
    const copiedMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [playerName] = useState<string>(() => {
        const urlPlayerName = queryParams.get('playerName');
        if (urlPlayerName) {
            try {
                localStorage.setItem(`playerName_${lobbyCode}`, urlPlayerName);
            } catch (error) {
                console.error('Failed to save player name:', error);
            }
            return urlPlayerName;
        }
        try {
            const savedPlayerName = localStorage.getItem(`playerName_${lobbyCode}`);
            if (savedPlayerName) {
                return savedPlayerName;
            }
        } catch (error) {
            console.error('Failed to load player name:', error);
        }
        const randomName = `Joueur${Math.floor(Math.random() * 1000)}`;
        try {
            localStorage.setItem(`playerName_${lobbyCode}`, randomName);
        } catch (error) {
            console.error('Failed to save generated player name:', error);
        }
        return randomName;
    });

    const [avatarId] = useState<number>(() => {
        const urlAvatarId = queryParams.get('avatarId');
        if (urlAvatarId !== null) {
            const id = parseInt(urlAvatarId, 10);
            if (!isNaN(id)) {
                try {
                    localStorage.setItem(`avatarId_${lobbyCode}`, String(id));
                } catch (error) {
                    console.error('Failed to save avatar id:', error);
                }
                return id;
            }
        }
        try {
            const savedAvatarId = localStorage.getItem(`avatarId_${lobbyCode}`);
            if (savedAvatarId !== null) {
                const id = parseInt(savedAvatarId, 10);
                if (!isNaN(id)) return id;
            }
        } catch (error) {
            console.error('Failed to load avatar id:', error);
        }
        return Math.floor(Math.random() * AVATARS.length);
    });

    useLeavePrompt(
        () => {
            if (currentPlayer && lobbyCode) {
                socket.emit('leaveLobby', { lobbyCode: lobbyCode!, currentPlayerId: currentPlayer.id });
            }
        },
        !!currentPlayer
    );

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (copiedMessageTimeoutRef.current) {
                clearTimeout(copiedMessageTimeoutRef.current);
            }
        };
    }, []);

    const generateLink = useCallback(() => {
        const link = `${window.location.origin}/?lobbyCode=${lobbyCode!}`;

        // Helper to show copied message with proper cleanup
        const showCopied = () => {
            if (copiedMessageTimeoutRef.current) {
                clearTimeout(copiedMessageTimeoutRef.current);
            }
            setShowCopiedMessage(true);
            copiedMessageTimeoutRef.current = setTimeout(() => setShowCopiedMessage(false), GAME_CONFIG.COPIED_MESSAGE_DURATION);
        };

        // Fonction de fallback pour copier sans l'API Clipboard (HTTP non-localhost)
        const fallbackCopy = (text: string) => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showCopied();
            } catch (err) {
                console.error('Fallback copy failed:', err);
                alert(`Lien à copier: ${text}`);
            }
            document.body.removeChild(textarea);
        };

        // Utiliser l'API Clipboard si disponible, sinon fallback
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(link)
                .then(() => showCopied())
                .catch(() => fallbackCopy(link));
        } else {
            fallbackCopy(link);
        }
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

    useEffect(() => {
        if (lobbyCode && playerName) {
            socket.emit('joinLobby', { lobbyCode: lobbyCode!, playerName, avatarId });
        }
    }, [lobbyCode, playerName, avatarId]);

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
        if (currentPlayer) {
            try {
                localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
            } catch (error) {
                console.error('Failed to save current player:', error);
            }
        }
        navigate(`/game/${lobbyCode}`);
    }, [currentPlayer, lobbyCode, navigate]);

    useSocketEvent('updatePlayersList', handleUpdatePlayersList, [handleUpdatePlayersList]);
    useSocketEvent('joinedLobby', handleJoinedLobby, [handleJoinedLobby]);
    useSocketEvent('kickedFromLobby', handleKickedFromLobby, [handleKickedFromLobby]);
    useSocketEvent('error', handleError, [handleError]);
    useSocketEvent('gameStarted', handleGameStarted, [handleGameStarted]);

    const activePlayers = players.filter(p => p.isActive);
    const canStartGame = activePlayers.length >= GAME_CONFIG.MIN_PLAYERS;

    return (
        <div className="min-h-screen flex flex-col">
            {/* Contenu principal */}
            <div className="flex-1 w-full max-w-screen-xl mx-auto px-3 md:px-4 py-3 md:py-6">
                {/* Logo */}
                <div className="flex justify-center mb-3 md:mb-6">
                    <Logo size="small" />
                </div>

                {/* Grille responsive */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Spacer gauche - desktop only */}
                    <div className="hidden md:block md:col-span-3" />

                    {/* Bloc principal */}
                    <div className="md:col-span-6">
                        <Frame>
                            {/* Header avec bouton quitter */}
                            <div className="flex items-center cursor-pointer self-start" onClick={leaveLobby}>
                                <span className="flex items-center mr-1.5">
                                    <BsFillCaretLeftFill size={15} />
                                </span>
                                <span className="text-sm md:text-base">Quitter</span>
                            </div>

                            {/* Compteur de joueurs */}
                            <div className="flex flex-row sm:flex-row items-center gap-1 sm:gap-2 justify-center">
                                <h3 className="m-0 font-bold text-center text-base md:text-lg">
                                    Joueurs {activePlayers.length}/{GAME_CONFIG.MAX_PLAYERS}
                                </h3>
                                <span className="text-xs md:text-sm text-gray-500 italic">
                                    ({GAME_CONFIG.MIN_PLAYERS} joueurs minimum)
                                </span>
                            </div>

                            {/* Liste des joueurs */}
                            <ul className="list-none w-full m-0 p-0 max-h-[40vh] md:max-h-[50vh] overflow-y-auto">
                                {players.map((player, index) => (
                                    <li key={player.id}>
                                        <PlayerCard
                                            id={player.id}
                                            name={player.name}
                                            avatarId={player.avatarId}
                                            isHost={player.isHost}
                                            isCurrentPlayer={currentPlayer?.id === player.id}
                                            currentPlayerIsHost={!!currentPlayer?.isHost}
                                            isActive={player.isActive}
                                            isFirstPlayer={index === 0}
                                            onKick={kickPlayer}
                                            onPromote={promotePlayer}
                                        />
                                    </li>
                                ))}
                            </ul>

                            {/* Actions - responsive layout */}
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start justify-center w-full">
                                {/* Bouton lancer le jeu */}
                                {currentPlayer?.isHost ? (
                                    <Button
                                        text="Lancer le jeu"
                                        variant="success"
                                        size="md"
                                        rotateEffect
                                        disabled={!canStartGame}
                                        onClick={startGame}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2 text-gray-500">
                                        <span className="text-lg animate-pulse">⏳</span>
                                        <span className="text-sm italic ">Seul l'hôte peut lancer le jeu</span>
                                    </div>
                                )}

                                {/* Code et lien d'invitation */}
                                <div className="flex flex-col gap-1 items-center">
                                    <Button
                                        text="Copier le lien d'invitation"
                                        variant="warning"
                                        size="sm"
                                        onClick={generateLink}
                                    />
                                    <small className={`text-gray-500 text-xs ${showCopiedMessage ? 'visible' : 'invisible'}`}>
                                        <i>Lien copié !</i>
                                    </small>
                                </div>
                            </div>
                        </Frame>
                    </div>

                    {/* Spacer droit - desktop only */}
                    <div className="hidden md:block md:col-span-3" />
                </div>
            </div>

            {/* Footer */}
            <Footer />
        </div>
    );
};

export default Lobby;
