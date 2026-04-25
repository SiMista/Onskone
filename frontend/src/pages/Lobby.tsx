import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Button from '../components/Button';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import InfoModal from '../components/InfoModal';
import { BsFillCaretLeftFill } from "react-icons/bs";
import { Icon } from '@iconify/react';
import PlayerCard from '../components/PlayerCard';
import DeckSelector from '../components/DeckSelector';
import { IPlayer, DecksCatalog, SelectedDecks } from '@onskone/shared';
import { useSocketEvent, useQueryParams, useLeavePrompt } from '../hooks';
import { useToast } from '../components/Toast';
import { GAME_CONFIG, AVATARS } from '../constants/game';

const RECOMMENDED_PLAYERS = 4;

const Lobby = () => {
    const { lobbyCode } = useParams<{ lobbyCode: string }>();
    const queryParams = useQueryParams();
    const navigate = useNavigate();
    const showToast = useToast();

    // Redirect if no lobby code
    useEffect(() => {
        if (!lobbyCode) {
            navigate('/');
        }
    }, [lobbyCode, navigate]);

    const [players, setPlayers] = useState<IPlayer[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(null);
    const [showFewPlayersModal, setShowFewPlayersModal] = useState(false);
    const [showGameAlreadyStarted, setShowGameAlreadyStarted] = useState(false);
    const [fallbackLink, setFallbackLink] = useState<string | null>(null);
    const [decksCatalog, setDecksCatalog] = useState<DecksCatalog>({});
    const [selectedDecks, setSelectedDecks] = useState<SelectedDecks>({});
    const [lobbyTab, setLobbyTab] = useState<'themes' | 'players'>('themes');
    const initialPlayerIdsRef = useRef<Set<string> | null>(null);
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

    // Avertissement avant de quitter la page (le serveur gère la déconnexion automatiquement via socket.disconnect)
    useLeavePrompt(undefined, !!currentPlayer);

    const generateLink = useCallback(() => {
        const link = `${window.location.origin}/?lobbyCode=${lobbyCode!}`;

        const showCopied = () => {
            showToast('Lien copié ! Envoie le à tes amis', 'success');
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
                setFallbackLink(text);
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
    }, [lobbyCode, showToast]);

    const leaveLobby = useCallback(() => {
        if (currentPlayer && lobbyCode) {
            socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer.id });
        }
        navigate(`/?lobbyCode=${lobbyCode}`);
    }, [currentPlayer, lobbyCode, navigate]);

    const kickPlayer = useCallback((playerId: string) => {
        if (lobbyCode) {
            socket.emit('kickPlayer', { lobbyCode, playerId });
        }
    }, [lobbyCode]);

    const promotePlayer = useCallback((playerId: string) => {
        if (lobbyCode) {
            socket.emit('promotePlayer', { lobbyCode, playerId });
        }
    }, [lobbyCode]);

    const doStartGame = useCallback(() => {
        if (lobbyCode) {
            socket.emit('startGame', { lobbyCode });
        }
    }, [lobbyCode]);

    const startGame = useCallback(() => {
        const activeCount = players.filter(p => p.isActive).length;
        if (activeCount < RECOMMENDED_PLAYERS) {
            setShowFewPlayersModal(true);
        } else {
            doStartGame();
        }
    }, [players, doStartGame]);

    // Rejoindre le lobby au montage ET lors d'une reconnexion socket
    useEffect(() => {
        const joinLobbyFn = () => {
            if (lobbyCode && playerName) {
                socket.emit('joinLobby', { lobbyCode, playerName, avatarId });
            }
        };

        // Rejoindre au montage
        joinLobbyFn();

        // Écouter les reconnexions socket (après perte de connexion)
        socket.on('connect', joinLobbyFn);

        // MOBILE: Écouter quand l'app redevient visible (retour après changement d'app)
        // Sur mobile, le socket peut être "pausé" sans se déconnecter complètement
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (socket.connected) {
                    // Socket déjà connecté - resynchroniser immédiatement
                    joinLobbyFn();
                } else {
                    // Socket déconnecté - attendre la reconnexion avant d'appeler joinLobby
                    socket.once('connect', joinLobbyFn);
                    socket.connect();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            socket.off('connect', joinLobbyFn);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [lobbyCode, playerName, avatarId]);

    const handleUpdatePlayersList = useCallback((data: { players: IPlayer[] }) => {
        if (initialPlayerIdsRef.current === null && data.players.length > 0) {
            initialPlayerIdsRef.current = new Set(data.players.map(p => p.id));
        }
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
        showToast('Tu as été expulsé du salon.', 'error', 4500);
        navigate('/');
    }, [navigate, showToast]);

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

    const handleGameAlreadyStarted = useCallback(() => {
        setShowGameAlreadyStarted(true);
    }, []);

    const handleLobbyDecksState = useCallback((data: { catalog: DecksCatalog; selected: SelectedDecks }) => {
        setDecksCatalog(data.catalog);
        setSelectedDecks(data.selected);
    }, []);

    const handleSelectedDecksChange = useCallback((next: SelectedDecks) => {
        setSelectedDecks(next);
        if (lobbyCode) {
            socket.emit('updateSelectedDecks', { lobbyCode, selected: next });
        }
    }, [lobbyCode]);

    useSocketEvent('updatePlayersList', handleUpdatePlayersList, [handleUpdatePlayersList]);
    useSocketEvent('joinedLobby', handleJoinedLobby, [handleJoinedLobby]);
    useSocketEvent('kickedFromLobby', handleKickedFromLobby, [handleKickedFromLobby]);
    useSocketEvent('error', handleError, [handleError]);
    useSocketEvent('gameStarted', handleGameStarted, [handleGameStarted]);
    useSocketEvent('gameAlreadyStarted', handleGameAlreadyStarted, [handleGameAlreadyStarted]);
    useSocketEvent('lobbyDecksState', handleLobbyDecksState, [handleLobbyDecksState]);

    const activePlayers = players.filter(p => p.isActive);
    const hostName = players.find(p => p.isHost)?.name ?? 'le host';
    const enoughPlayers = activePlayers.length >= GAME_CONFIG.MIN_PLAYERS;
    const totalThemesSelected = Object.values(selectedDecks).reduce((acc, arr) => acc + arr.length, 0);
    const hasThemeSelected = totalThemesSelected > 0;
    const canStartGame = enoughPlayers && hasThemeSelected;

    // Liste des joueurs — mobile : grille 3/ligne
    const playersListMobile = (
        <ul className="list-none w-full m-0 p-0 grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
            {players.map((player, index) => (
                <li key={player.id} className={`min-w-0 ${initialPlayerIdsRef.current?.has(player.id) ? '' : 'animate-player-pop'}`} style={initialPlayerIdsRef.current?.has(player.id) ? undefined : { animationDelay: `${Math.min(index, 6) * 50}ms` }}>
                    <PlayerCard
                        id={player.id}
                        name={player.name}
                        avatarId={player.avatarId}
                        isHost={player.isHost}
                        isCurrentPlayer={currentPlayer?.id === player.id}
                        currentPlayerIsHost={!!currentPlayer?.isHost}
                        isActive={player.isActive}
                        isFirstPlayer={index < 3}
                        variant="square"
                        onKick={kickPlayer}
                        onPromote={promotePlayer}
                    />
                </li>
            ))}
            {players.length < GAME_CONFIG.MAX_PLAYERS && (
                <li className="min-w-0">
                    <div className="relative aspect-square flex flex-col items-center justify-center gap-1 p-2 rounded-[10px] w-full border-2 border-dashed border-gray-300 bg-gray-50/50">
                        <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-lg">?</div>
                        <span className="text-[10px] text-gray-400 italic text-center truncate w-full px-1">...</span>
                    </div>
                </li>
            )}
        </ul>
    );

    const deckSelectorEl = (
        <DeckSelector
            catalog={decksCatalog}
            selected={selectedDecks}
            readOnly={!currentPlayer?.isHost}
            hostName={hostName}
            onChange={handleSelectedDecksChange}
        />
    );

    return (
        <div className="min-h-screen flex flex-col animate-phase-enter">
            {/* Contenu principal */}
            <div className="flex-1 w-full max-w-2xl md:max-w-3xl mx-auto px-3 md:px-4 py-3 md:py-6">
                {/* Logo top */}
                <div className="flex justify-center mt-3 md:mt-4 mb-4 md:mb-6">
                    <Logo size="small" />
                </div>

                {/* ===================== LAYOUT UNIFIÉ ===================== */}
                <div className="flex flex-col gap-3 md:gap-4">
                    {/* Bouton retour standalone, juste au-dessus des tabs */}
                    <button
                        type="button"
                        onClick={leaveLobby}
                        className="self-start inline-flex items-center gap-1 text-white text-sm md:text-base font-display font-bold tracking-wide cursor-pointer hover:-translate-x-0.5 transition-transform px-1 py-1 drop-shadow -mb-1"
                        aria-label="Retour"
                    >
                        <BsFillCaretLeftFill size={15} />
                        <span>Retour</span>
                    </button>

                    {/* Tabs : intercalaires cartonnés en éventail, coins asymétriques */}
                    <div className="flex gap-1 md:gap-1.5 -mb-[2.5px] relative z-10 px-1">
                        {([
                            {
                                id: 'themes' as const,
                                color: '#FFC700',
                                label: 'Thèmes',
                                badge: totalThemesSelected > 0 ? String(totalThemesSelected) : null,
                                outer: 'left' as const,
                            },
                            {
                                id: 'players' as const,
                                color: '#1AAFDA',
                                label: 'Joueurs',
                                badge: `${activePlayers.length}/${GAME_CONFIG.MAX_PLAYERS}`,
                                outer: 'right' as const,
                            },
                        ]).map(t => {
                            const active = lobbyTab === t.id;
                            // Coin "extérieur" généreusement arrondi (bord du panel),
                            // coin "intérieur" (entre les deux tabs) légèrement biseauté.
                            const radiusClasses = t.outer === 'left'
                                ? 'rounded-tl-[22px] rounded-tr-md'
                                : 'rounded-tr-[22px] rounded-tl-md';
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setLobbyTab(t.id)}
                                    className={`flex-1 relative inline-flex items-center justify-center gap-2 px-3 md:px-4 pt-2 md:pt-2.5 pb-3 md:pb-3.5 bg-white ${radiusClasses} border-[2.5px] border-b-0 border-black cursor-pointer transition-all duration-200 origin-bottom overflow-hidden
                                        ${active
                                            ? 'shadow-[3px_-3px_0_0_rgba(0,0,0,0.18)] z-20'
                                            : 'translate-y-1 hover:translate-y-0 z-10 opacity-90 hover:opacity-100'}
                                    `}
                                >
                                    {/* Bande accent inférieure colorée — plus haute si actif */}
                                    <span
                                        className={`absolute left-0 right-0 bottom-0 pointer-events-none transition-[height] duration-200 ${active ? 'h-2 md:h-2.5' : 'h-1.5'}`}
                                        style={{ backgroundColor: t.color }}
                                        aria-hidden
                                    />

                                    <span
                                        className={`relative font-display font-bold tracking-[0.08em] uppercase text-sm md:text-base ${
                                            active ? 'text-black' : 'text-gray-600'
                                        }`}
                                    >
                                        {t.label}
                                    </span>

                                    {t.badge && (
                                        <span
                                            className={`relative shrink-0 font-display text-[11px] md:text-xs font-bold tabular-nums whitespace-nowrap bg-white/80 rounded-full px-2 py-0.5 border border-black/15 ${
                                                active ? 'text-black/85' : 'text-black/60'
                                            }`}
                                        >
                                            {t.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Panel de la tab active — coin haut côté tab actif carré, coin opposé arrondi */}
                    <div
                        key={lobbyTab}
                        role="tabpanel"
                        className={`bg-white border-[2.5px] border-black rounded-b-2xl stack-shadow texture-paper p-3 md:p-4 animate-phase-enter ${
                            lobbyTab === 'themes' ? 'rounded-tr-2xl rounded-tl-none' : 'rounded-tl-2xl rounded-tr-none'
                        }`}
                    >
                        {lobbyTab === 'themes' ? deckSelectorEl : playersListMobile}
                    </div>

                    {/* ===================== ACTION ROW : Démarrer + Copier le lien ===================== */}
                    <div className="flex flex-col items-center gap-1.5 mt-1 md:mt-2">
                        <div className="flex flex-row items-center justify-center gap-3 md:gap-4 w-full flex-wrap">
                            {currentPlayer?.isHost ? (
                                <Button
                                    text="Démarrer"
                                    variant="success"
                                    size="md"
                                    rotateEffect
                                    disabled={!canStartGame}
                                    onClick={startGame}
                                />
                            ) : (
                                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/85 border-[2.5px] border-black stack-shadow-sm text-gray-700">
                                    <Icon icon="fluent-emoji-flat:hourglass-not-done" className="animate-spin-slow" width="1.1em" height="1.1em" aria-hidden />
                                    <span className="text-sm font-display italic truncate">En attente de {hostName}…</span>
                                </div>
                            )}
                            <Button
                                text="Copier le lien d'invitation"
                                variant="warning"
                                size="sm"
                                className="!text-xs md:!text-sm whitespace-nowrap"
                                onClick={generateLink}
                            />
                        </div>

                        {/* Helper text sous l'action row */}
                        {currentPlayer?.isHost && !enoughPlayers && (
                            <small className="text-[11px] md:text-xs text-white/85 italic drop-shadow text-center">
                                Il faut au moins {GAME_CONFIG.MIN_PLAYERS} joueurs pour lancer
                            </small>
                        )}
                        {currentPlayer?.isHost && enoughPlayers && !hasThemeSelected && (
                            <small className="text-[11px] md:text-xs text-white/85 italic drop-shadow text-center">
                                Sélectionne au moins 1 thème
                            </small>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer — desktop uniquement (caché par la sticky bar sur mobile) */}
            <div className="hidden md:block">
                <Footer />
            </div>

            {/* Modal de confirmation pour peu de joueurs */}
            <ConfirmModal
                isOpen={showFewPlayersModal}
                onClose={() => setShowFewPlayersModal(false)}
                onConfirm={doStartGame}
                title="Pas beaucoup de joueurs :("
                message="La partie serait plus amusante avec au moins 4 joueurs. Démarrer la partie quand même ?"
                confirmText="Lancer"
                cancelText="Attendre"
                confirmVariant="success"
            />

            {/* Modal partie déjà commencée */}
            <InfoModal
                isOpen={showGameAlreadyStarted}
                onClose={() => {
                    setShowGameAlreadyStarted(false);
                    navigate('/');
                }}
                title="Partie déjà lancée"
            >
                <div className="text-center space-y-4">
                    <Icon icon="fluent-emoji-flat:crying-face" className="mx-auto" width="4rem" height="4rem" aria-hidden />
                    <p className="text-gray-700">
                        Ohhhhhh mince ! La partie a déjà été lancée et tu ne peux pas la rejoindre en cours de route...
                    </p>
                    <p className="text-sm text-gray-500 italic">
                        Petit conseil : changer d'amis.
                    </p>
                </div>
            </InfoModal>

            {/* Modal fallback : affiche le lien quand le copier-coller automatique a échoué */}
            <InfoModal
                isOpen={fallbackLink !== null}
                onClose={() => setFallbackLink(null)}
                title="Copie le lien à la main"
            >
                <div className="space-y-3">
                    <p className="text-sm text-gray-700 m-0">
                        Le copier-coller automatique n'a pas fonctionné. Sélectionne le lien ci-dessous :
                    </p>
                    <input
                        type="text"
                        readOnly
                        value={fallbackLink ?? ''}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full text-sm font-mono text-gray-900 bg-[#f9f4ee] border-[2.5px] border-black rounded-lg px-3 py-2 outline-none stack-shadow-sm"
                    />
                </div>
            </InfoModal>
        </div>
    );
};

export default Lobby;
