import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Button from '../components/Button';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import InfoModal from '../components/InfoModal';
import HowToPlayCarousel from '../components/HowToPlayCarousel';
import HowToPlayButton from '../components/HowToPlayButton';
import { Icon } from '@iconify/react';
import PlayerCard from '../components/PlayerCard';
import DeckSelector from '../components/DeckSelector';
import BackButton from '../components/BackButton';
import { IPlayer, DecksCatalog, SelectedDecks, GameMode } from '@onskone/shared';
import { useSocketEvent, useQueryParams, useLeavePrompt, useReconnectOnVisible } from '../hooks';
import { useToast } from '../components/Toast';
import { GAME_CONFIG, AVATARS } from '../constants/game';
import { studioStorage, isStudioFrame } from '../utils/studioStorage';

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
    const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
    const [fallbackLink, setFallbackLink] = useState<string | null>(null);
    const [decksCatalog, setDecksCatalog] = useState<DecksCatalog>({});
    const [selectedDecks, setSelectedDecks] = useState<SelectedDecks>({});
    const [lobbyTab, setLobbyTab] = useState<'settings' | 'players'>('settings');
    const [gameMode, setGameMode] = useState<GameMode>('local');
    const [guessMyAnswerMode, setGuessMyAnswerMode] = useState<boolean>(false);
    const initialPlayerIdsRef = useRef<Set<string> | null>(null);
    const prevHostIdRef = useRef<string | null>(null);
    const [playerName] = useState<string>(() => {
        const urlPlayerName = queryParams.get('playerName');
        if (urlPlayerName) {
            studioStorage.setItem(`playerName_${lobbyCode}`, urlPlayerName);
            return urlPlayerName;
        }
        const savedPlayerName = studioStorage.getItem(`playerName_${lobbyCode}`);
        if (savedPlayerName) {
            return savedPlayerName;
        }
        const randomName = `Joueur${Math.floor(Math.random() * 1000)}`;
        studioStorage.setItem(`playerName_${lobbyCode}`, randomName);
        return randomName;
    });

    const [avatarId] = useState<number>(() => {
        const urlAvatarId = queryParams.get('avatarId');
        if (urlAvatarId !== null) {
            const id = parseInt(urlAvatarId, 10);
            if (!isNaN(id)) {
                studioStorage.setItem(`avatarId_${lobbyCode}`, String(id));
                return id;
            }
        }
        const savedAvatarId = studioStorage.getItem(`avatarId_${lobbyCode}`);
        if (savedAvatarId !== null) {
            const id = parseInt(savedAvatarId, 10);
            if (!isNaN(id)) return id;
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
        const isAlone = players.filter(p => p.isActive).length <= 1;
        if (currentPlayer && lobbyCode) {
            socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer.id });
        }
        if (isAlone) {
            showToast('Tu étais seul dans le salon, il a été supprimé', 'info', 5000);
        }
        navigate(`/?lobbyCode=${lobbyCode}`);
    }, [currentPlayer, lobbyCode, navigate, players, showToast]);

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

    // Rejoindre le lobby au montage ET lors d'une reconnexion socket / retour de l'app au premier plan
    const joinLobbyFn = useCallback(() => {
        if (lobbyCode && playerName) {
            socket.emit('joinLobby', { lobbyCode, playerName, avatarId });
        }
    }, [lobbyCode, playerName, avatarId]);

    useEffect(() => {
        joinLobbyFn();
    }, [joinLobbyFn]);

    useReconnectOnVisible(joinLobbyFn);

    // Studio: if this iframe is the host bot AND we've reached the recommended
    // player count, auto-start the game. Re-armed once per lobby visit.
    const studioAutoStartedRef = useRef(false);
    useEffect(() => {
        if (!isStudioFrame) return;
        if (studioAutoStartedRef.current) return;
        try {
            if (sessionStorage.getItem('studioBot') !== '1') return;
        } catch { return; }
        if (!currentPlayer?.isHost) return;
        const activeCount = players.filter(p => p.isActive).length;
        if (activeCount < GAME_CONFIG.MIN_PLAYERS) return;
        // Need a theme selected; let the server default kick in via decksCatalog
        // - if nothing is preselected, pick the first available theme.
        if (Object.values(selectedDecks).reduce((acc, arr) => acc + arr.length, 0) === 0) {
            const firstCat = Object.keys(decksCatalog)[0];
            const firstTheme = firstCat ? Object.keys(decksCatalog[firstCat] ?? {})[0] : undefined;
            if (firstCat && firstTheme) {
                socket.emit('updateSelectedDecks', {
                    lobbyCode: lobbyCode!,
                    selected: { [firstCat]: [firstTheme] },
                });
                return; // wait for state update, will retry next effect run
            }
            return;
        }
        studioAutoStartedRef.current = true;
        const t = setTimeout(() => {
            socket.emit('startGame', { lobbyCode: lobbyCode! });
        }, 1200);
        return () => clearTimeout(t);
    }, [currentPlayer?.isHost, players, selectedDecks, decksCatalog, lobbyCode]);

    const handleUpdatePlayersList = useCallback((data: { players: IPlayer[] }) => {
        if (initialPlayerIdsRef.current === null && data.players.length > 0) {
            initialPlayerIdsRef.current = new Set(data.players.map(p => p.id));
        }

        const newHost = data.players.find(p => p.isHost);
        const newHostId = newHost?.id ?? null;
        if (prevHostIdRef.current !== null && newHostId !== null && prevHostIdRef.current !== newHostId) {
            const me = data.players.find(p => p.socketId === socket.id);
            if (me?.isHost) {
                showToast('Tu es maintenant le chef du salon !', 'success', 4000);
            } else if (newHost) {
                showToast(`${newHost.name} est maintenant le chef du salon`, 'info', 4000);
            }
        }
        prevHostIdRef.current = newHostId;

        setPlayers(data.players);
        const potentialCurrentPlayer = data.players.find((p: IPlayer) => p.socketId === socket.id);
        if (potentialCurrentPlayer) {
            setCurrentPlayer(potentialCurrentPlayer);
        }
    }, [showToast]);

    const handleJoinedLobby = useCallback((data: { player: IPlayer }) => {
        setCurrentPlayer(data.player);
    }, []);

    const handleKickedFromLobby = useCallback((data?: { hostName?: string }) => {
        const message = data?.hostName
            ? `${data.hostName} t'a expulsé du salon`
            : 'Tu as été expulsé du salon';
        showToast(message, 'error', 4500);
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
            studioStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
        }
        navigate(`/game/${lobbyCode}`);
    }, [currentPlayer, lobbyCode, navigate]);

    const handleGameAlreadyStarted = useCallback(() => {
        setShowGameAlreadyStarted(true);
    }, []);

    const handleLobbyClosed = useCallback(() => {
        showToast('Ce salon a été fermé pour inactivité', 'error', 4500);
        navigate('/');
    }, [navigate, showToast]);

    const handleLobbyDecksState = useCallback((data: { catalog: DecksCatalog; selected: SelectedDecks; gameMode: GameMode; guessMyAnswerMode?: boolean }) => {
        setDecksCatalog(data.catalog);
        setSelectedDecks(data.selected);
        setGameMode(data.gameMode);
        setGuessMyAnswerMode(!!data.guessMyAnswerMode);
    }, []);

    const handleGuessMyAnswerModeUpdated = useCallback((data: { guessMyAnswerMode: boolean }) => {
        setGuessMyAnswerMode(!!data.guessMyAnswerMode);
    }, []);

    const settingsEmitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const queueSettingEmit = useCallback((key: string, fn: () => void, delay = 150) => {
        const timers = settingsEmitTimers.current;
        if (timers[key]) clearTimeout(timers[key]);
        timers[key] = setTimeout(() => {
            delete timers[key];
            fn();
        }, delay);
    }, []);

    useEffect(() => {
        return () => {
            const timers = settingsEmitTimers.current;
            Object.values(timers).forEach(clearTimeout);
            settingsEmitTimers.current = {};
        };
    }, []);

    const handleGuessMyAnswerModeChange = useCallback((next: boolean) => {
        setGuessMyAnswerMode(next);
        if (!lobbyCode) return;
        queueSettingEmit('guessMyAnswerMode', () => {
            socket.emit('updateGuessMyAnswerMode', { lobbyCode, guessMyAnswerMode: next });
        });
    }, [lobbyCode, queueSettingEmit]);

    const handleSelectedDecksChange = useCallback((next: SelectedDecks) => {
        setSelectedDecks(next);
        if (!lobbyCode) return;
        queueSettingEmit('selectedDecks', () => {
            socket.emit('updateSelectedDecks', { lobbyCode, selected: next });
        });
    }, [lobbyCode, queueSettingEmit]);

    const handleGameModeChange = useCallback((next: GameMode) => {
        setGameMode(next);
        if (!lobbyCode) return;
        queueSettingEmit('gameMode', () => {
            socket.emit('updateGameMode', { lobbyCode, gameMode: next });
        });
    }, [lobbyCode, queueSettingEmit]);

    useSocketEvent('updatePlayersList', handleUpdatePlayersList, [handleUpdatePlayersList]);
    useSocketEvent('joinedLobby', handleJoinedLobby, [handleJoinedLobby]);
    useSocketEvent('kickedFromLobby', handleKickedFromLobby, [handleKickedFromLobby]);
    useSocketEvent('error', handleError, [handleError]);
    useSocketEvent('gameStarted', handleGameStarted, [handleGameStarted]);
    useSocketEvent('gameAlreadyStarted', handleGameAlreadyStarted, [handleGameAlreadyStarted]);
    useSocketEvent('lobbyClosed', handleLobbyClosed, [handleLobbyClosed]);
    useSocketEvent('lobbyDecksState', handleLobbyDecksState, [handleLobbyDecksState]);
    useSocketEvent('guessMyAnswerModeUpdated', handleGuessMyAnswerModeUpdated, [handleGuessMyAnswerModeUpdated]);

    const activePlayers = players.filter(p => p.isActive);
    const hostName = players.find(p => p.isHost)?.name ?? 'le host';
    const enoughPlayers = activePlayers.length >= GAME_CONFIG.MIN_PLAYERS;
    const totalThemesSelected = Object.values(selectedDecks).reduce((acc, arr) => acc + arr.length, 0);
    const hasThemeSelected = totalThemesSelected > 0;
    const canStartGame = enoughPlayers && hasThemeSelected;

    // Liste des joueurs - mobile : 3/ligne, desktop : 4/ligne (même format carré)
    const playersListMobile = (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
                <p className="m-0 font-display font-bold text-sm text-gray-800">Dans le salon</p>
                <p className="m-0 text-xs text-gray-400">{activePlayers.length} joueur{activePlayers.length > 1 ? 's' : ''} connecté{activePlayers.length > 1 ? 's' : ''}</p>
            </div>
            <ul className="list-none w-full m-0 p-0 grid grid-cols-3 md:grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto">
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
                        <div className="relative aspect-square flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-[10px] w-full border-2 border-dashed border-gray-300 bg-gray-50/50">
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-xl">?</div>
                            <span className="text-xs text-gray-400 italic text-center truncate w-full px-1">...</span>
                        </div>
                    </li>
                )}
            </ul>
        </div>
    );

    const isHost = !!currentPlayer?.isHost;

    const localActive = gameMode === 'local';

    const settingsPanelEl = (
        <div className="flex flex-col gap-4">
            {!isHost && (
                <div className="flex justify-center pt-4 pb-1">
                    <div className="relative rotate-[-1.2deg] hover:rotate-0 transition-transform duration-300 ease-out">
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cream-kraft border-[2.5px] border-black rounded-lg stack-shadow-sm texture-paper">
                            <span className="font-display text-[13px] tracking-tight text-black leading-snug whitespace-nowrap">
                                Seul{' '}
                                <span className="relative inline-block font-bold uppercase bg-black text-warning-500 px-1.5 py-0.5 rounded-md">
                                    <Icon
                                        icon="fluent-emoji-flat:crown"
                                        width={20}
                                        height={20}
                                        aria-hidden
                                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 [filter:drop-shadow(1px_1.5px_0_rgba(0,0,0,0.5))]"
                                    />
                                    {hostName && hostName.length > 10 ? `${hostName.slice(0, 10)}…` : hostName}
                                </span>{' '}
                                peut modifier les paramètres
                            </span>
                        </div>
                        {/* ruban adhésif par dessus */}
                        <span
                            aria-hidden
                            className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-12 h-3.5 bg-warning-500/80 border-[1.5px] border-black/60 rounded-[2px] rotate-[-3deg] [box-shadow:1px_1px_0_0_rgba(0,0,0,0.3)]"
                        />
                    </div>
                </div>
            )}
            {/* Slider mode de jeu - tout en haut, sans titre de section */}
            <div className={`flex items-start gap-3.5 ${!isHost ? 'opacity-65 pointer-events-none' : ''}`}>
                <button
                    type="button"
                    role="switch"
                    aria-checked={!localActive}
                    aria-label={`Mode ${localActive ? 'sur place' : 'à distance'} - cliquer pour basculer`}
                    disabled={!isHost}
                    onClick={() => handleGameModeChange(localActive ? 'remote' : 'local')}
                    className="relative inline-flex shrink-0 w-[6rem] h-10 md:w-[7.25rem] md:h-12 border-[2.5px] border-black rounded-full overflow-hidden bg-cream-player stack-shadow-sm texture-paper transition-transform duration-150 active:scale-[0.96] cursor-pointer"
                >
                    <span
                        className={`absolute top-0.5 h-[1.85rem] w-[1.85rem] md:h-[2.25rem] md:w-[2.25rem] rounded-full border-[2.5px] border-black shadow-[1.5px_1.5px_0_0_rgba(0,0,0,0.85)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${localActive
                            ? 'left-0.5 bg-warning-500'
                            : 'left-[calc(100%-2.1rem)] md:left-[calc(100%-2.5rem)] bg-brand-200'
                            }`}
                        aria-hidden
                    />
                    <span className="relative z-10 flex w-full items-center justify-between px-2">
                        <Icon
                            icon="fluent-emoji-flat:busts-in-silhouette"
                            width="1em"
                            height="1em"
                            className={`text-[18px] md:text-[22px] -translate-y-1 [filter:drop-shadow(1px_1.5px_0_rgba(0,0,0,0.55))] transition-all duration-300 ease-out ${localActive ? 'scale-110 rotate-[-6deg]' : 'scale-75 saturate-0 opacity-40'}`}
                            aria-hidden
                        />
                        <Icon
                            icon="fluent-emoji-flat:globe-showing-europe-africa"
                            width="1em"
                            height="1em"
                            className={`text-[18px] md:text-[22px] -translate-x-0.5 -translate-y-0.5 [filter:drop-shadow(1px_1.5px_0_rgba(0,0,0,0.55))] transition-all duration-300 ease-out ${!localActive ? 'scale-110 rotate-[6deg]' : 'scale-75 saturate-0 opacity-40'}`}
                            aria-hidden
                        />
                    </span>
                </button>
                <div className="flex items-center gap-3">
                    <div
                        key={gameMode}
                        className="flex-1 min-w-0 animate-phase-enter translate-y-[7px]"
                    >
                        <div className="font-display text-sm md:text-base font-bold uppercase tracking-tight text-black leading-none">
                            {localActive ? 'Sur place' : 'À distance'}
                        </div>

                        <div className="font-sans text-[11px] text-gray-600 leading-snug mt-1">
                            {localActive
                                ? 'Dans la même pièce, les joueurs sont à proximité pour montrer leur téléphone'
                                : 'Chacun chez soi, les joueurs suivent la partie en direct sur leur écran'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Slider mode "Devine ma réponse" */}
            <div className={`flex items-start gap-3.5 ${!isHost ? 'opacity-65 pointer-events-none' : ''}`}>
                <button
                    type="button"
                    role="switch"
                    aria-checked={guessMyAnswerMode}
                    aria-label={`Mode "Devine ma réponse" - ${guessMyAnswerMode ? 'activé' : 'désactivé'}`}
                    disabled={!isHost}
                    onClick={() => handleGuessMyAnswerModeChange(!guessMyAnswerMode)}
                    className="relative inline-flex shrink-0 w-[6rem] h-10 md:w-[7.25rem] md:h-12 border-[2.5px] border-black rounded-full overflow-hidden bg-cream-player stack-shadow-sm texture-paper transition-transform duration-150 active:scale-[0.96] cursor-pointer"
                >
                    <span
                        className={`absolute top-0.5 h-[1.85rem] w-[1.85rem] md:h-[2.25rem] md:w-[2.25rem] rounded-full border-[2.5px] border-black shadow-[1.5px_1.5px_0_0_rgba(0,0,0,0.85)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${guessMyAnswerMode
                            ? 'left-[calc(100%-2.1rem)] md:left-[calc(100%-2.5rem)] bg-brand-200'
                            : 'left-0.5 bg-warning-500'
                            }`}
                        aria-hidden
                    />
                </button>
                <div className="flex items-center gap-3">
                    <div
                        key={guessMyAnswerMode ? 'on' : 'off'}
                        className="flex-1 min-w-0 animate-phase-enter translate-y-[7px]"
                    >
                        <div className="font-display text-sm md:text-base font-bold uppercase tracking-tight text-black leading-none">
                            {guessMyAnswerMode ? 'Devine ma réponse' : 'Classique'}
                        </div>

                        <div className="font-sans text-[11px] text-gray-600 leading-snug mt-1">
                            {guessMyAnswerMode
                                ? 'Un joueur est désigné pour écrire la réponse que le pilier aurait répondu'
                                : 'Seuls les joueurs répondent et le pilier devine qui a écrit quoi'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Thèmes */}
            <div className={`flex flex-col gap-2.5 ${!isHost ? 'opacity-65' : ''}`}>
                <div className="flex items-baseline gap-2">
                    <span className="font-display text-base font-bold uppercase tracking-tight text-black">Thèmes</span>
                    <span className="flex-1 h-px bg-black/10" />
                </div>
                <DeckSelector
                    catalog={decksCatalog}
                    selected={selectedDecks}
                    readOnly={!isHost}
                    onChange={handleSelectedDecksChange}
                />
            </div>
        </div>
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
                    {/* Bouton retour + raccourci "Comment jouer ?" sur la même ligne. */}
                    <div className="flex items-center justify-between gap-2">
                        <BackButton onClick={leaveLobby} label="Retour" tone="danger" />
                        <HowToPlayButton onClick={() => setIsHowToPlayOpen(true)} />
                    </div>

                    {/* Tabs : intercalaires cartonnés en éventail, coins asymétriques */}
                    <div className="flex gap-1 md:gap-1.5 -mb-[2.5px] relative z-10 px-1">
                        {([
                            {
                                id: 'settings' as const,
                                color: 'var(--color-warning-500)',
                                label: 'Paramètres',
                                badge: null,
                                outer: 'left' as const,
                            },
                            {
                                id: 'players' as const,
                                color: 'var(--color-brand-500)',
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
                                    {/* Bande accent inférieure colorée - plus haute si actif */}
                                    <span
                                        className={`absolute left-0 right-0 bottom-0 pointer-events-none transition-[height] duration-200 ${active ? 'h-2 md:h-2.5' : 'h-1.5'}`}
                                        style={{ backgroundColor: t.color }}
                                        aria-hidden
                                    />

                                    <span
                                        className={`relative font-display font-bold tracking-[0.08em] uppercase text-sm md:text-base ${active ? 'text-black' : 'text-gray-600'
                                            }`}
                                    >
                                        {t.label}
                                    </span>

                                    {t.badge && (
                                        <span
                                            className={`relative shrink-0 font-display text-[11px] md:text-xs font-bold tabular-nums whitespace-nowrap bg-white/80 rounded-full px-2 py-0.5 border border-black/15 ${active ? 'text-black/85' : 'text-black/60'
                                                }`}
                                        >
                                            {t.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Panel de la tab active - coin haut côté tab actif carré, coin opposé arrondi */}
                    <div
                        key={lobbyTab}
                        role="tabpanel"
                        className="bg-white border-[2.5px] border-black rounded-2xl stack-shadow texture-paper p-3 md:p-4 animate-phase-enter"
                    >
                        {lobbyTab === 'settings' ? settingsPanelEl : playersListMobile}
                    </div>

                    {/* ===================== ACTION ROW : Démarrer + Copier le lien ===================== */}
                    <div className="flex flex-col items-center gap-1.5 mt-1 md:mt-2">
                        <div className="flex flex-row items-center justify-center gap-3 md:gap-4 w-full flex-wrap">
                            {currentPlayer?.isHost ? (
                                <Button
                                    text="Démarrer"
                                    variant="success"
                                    size="lg"
                                    hero
                                    disabled={!canStartGame}
                                    onClick={startGame}
                                    className="!rotate-0"
                                />
                            ) : (
                                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/85 border-[2.5px] border-black stack-shadow-sm text-gray-700">
                                    <Icon icon="fluent-emoji-flat:hourglass-not-done" className="animate-spin-slow [filter:drop-shadow(1px_1.5px_0_rgba(0,0,0,0.5))]" width="1.1em" height="1.1em" aria-hidden />
                                    <span className="text-sm font-display italic truncate">Seul {hostName && hostName.length > 10 ? `${hostName.slice(0, 10)}…` : hostName} peut démarrer la partie</span>
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

            {/* Footer - desktop uniquement (caché par la sticky bar sur mobile) */}
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

            {/* Modal "Comment jouer ?" */}
            <InfoModal
                isOpen={isHowToPlayOpen}
                onClose={() => setIsHowToPlayOpen(false)}
                title="Comment jouer ?"
                variant="comic"
            >
                <HowToPlayCarousel />
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
                        className="w-full text-sm font-mono text-gray-900 bg-cream-player border-[2.5px] border-black rounded-lg px-3 py-2 outline-none stack-shadow-sm"
                    />
                </div>
            </InfoModal>
        </div>
    );
};

export default Lobby;
