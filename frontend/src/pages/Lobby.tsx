import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import socket from '../utils/socket';
import Button from '../components/Button';
import Logo from '../components/Logo';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import InfoModal from '../components/InfoModal';
import Checkbox from '../components/Checkbox';
import HowToPlayCarousel from '../components/HowToPlayCarousel';
import HowToPlayButton from '../components/HowToPlayButton';
import { Icon } from '@iconify/react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import PlayerCard from '../components/PlayerCard';
import ThemePickerModal from '../components/ThemePickerModal';
import BackButton from '../components/BackButton';
import ScrollFade from '../components/ScrollFade';
import GameSpeedSlider from '../components/GameSpeedSlider';
import { IPlayer, DecksCatalog, DecksCatalogWithMeta, SelectedDecks, GAME_CONSTANTS } from '@onskone/shared';
import type { ServerToClientEvents } from '@onskone/shared';
import { useSocketEvent, useLeavePrompt, useReconnectOnVisible } from '../hooks';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n';
import { GAME_CONFIG, AVATARS, getSoftCategoryColor, estimateGameMinutes } from '../constants/game';
import { STICKER_FILTER } from '../constants/icons';
import { studioStorage, isStudioFrame } from '../utils/studioStorage';

const RECOMMENDED_PLAYERS = 4;

const Lobby = () => {
    const { lobbyCode } = useParams<{ lobbyCode: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const showToast = useToast();
    const { t } = useLocale();

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
    const [decksCatalogMeta, setDecksCatalogMeta] = useState<DecksCatalogWithMeta>({});
    const [selectedDecks, setSelectedDecks] = useState<SelectedDecks>({});
    const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
    const [lobbyTab, setLobbyTab] = useState<'settings' | 'players'>('settings');
    const lobbyTabScrollRef = useRef<HTMLDivElement | null>(null);
    // Le scroll-container est partagé entre les 2 tabs (grid stacking).
    // Reset à 0 au switch pour éviter que la position scrollée des settings
    // contamine la vue Players (et que le ScrollFade reflète un mauvais état).
    useEffect(() => {
        const el = lobbyTabScrollRef.current;
        if (el) el.scrollTop = 0;
    }, [lobbyTab]);
    const [guessMyAnswerMode, setGuessMyAnswerMode] = useState<boolean>(false);
    const [timeMultiplier, setTimeMultiplier] = useState<number>(GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT);
    const initialPlayerIdsRef = useRef<Set<string> | null>(null);
    const prevHostIdRef = useRef<string | null>(null);
    const [playerName] = useState<string>(() => {
        const urlPlayerName = searchParams.get('playerName');
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
        const urlAvatarId = searchParams.get('avatarId');
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
    useLeavePrompt(!!currentPlayer);

    const shareInvite = useCallback(async () => {
        const link = `${window.location.origin}/?lobbyCode=${lobbyCode!}`;
        const message = t.lobby.shareInvite.message;
        // Texte copié dans le presse-papier : message + lien (l'API share gère le lien à part)
        const copyText = `${message} ${link}`;

        const showCopied = () => {
            showToast(t.lobby.toasts.linkCopied, 'success');
        };

        // Fallback pour copier sans l'API Clipboard (HTTP non-localhost)
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

        const copyToClipboard = (text: string) => {
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => showCopied())
                    .catch(() => fallbackCopy(text));
            } else {
                fallbackCopy(text);
            }
        };

        // 1. App native (Capacitor) : plugin Share = intent de partage Android/iOS fiable,
        // indépendant du secure context (marche même en live-reload http).
        if (Capacitor.isNativePlatform()) {
            try {
                await Share.share({ title: t.lobby.shareInvite.title, text: message, url: link });
            } catch {
                // Annulation ou indispo -> copie
                copyToClipboard(copyText);
            }
            return;
        }

        // 2. Web/PWA : Web Share API (mobile + Chrome/Edge desktop), exige un secure context (HTTPS)
        if (navigator.share) {
            try {
                await navigator.share({ title: t.lobby.shareInvite.title, text: message, url: link });
                return; // succès : la feuille native sert de feedback
            } catch (err) {
                // L'utilisateur a fermé/annulé la feuille -> ne rien faire
                if ((err as Error)?.name === 'AbortError') return;
                // Autre erreur (non supporté à l'exécution) -> on retombe sur la copie
            }
        }

        // 3. Fallback : copie du message + lien dans le presse-papier
        copyToClipboard(copyText);
    }, [lobbyCode, showToast, t]);

    const leaveLobby = useCallback(() => {
        const isAlone = players.filter(p => p.isActive).length <= 1;
        if (currentPlayer && lobbyCode) {
            socket.emit('leaveLobby', { lobbyCode, currentPlayerId: currentPlayer.id });
        }
        if (isAlone) {
            showToast(t.lobby.toasts.aloneRemoved, 'info', 5000);
        }
        navigate(`/?lobbyCode=${lobbyCode}`);
    }, [currentPlayer, lobbyCode, navigate, players, showToast, t]);

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
            const firstCode = firstCat ? decksCatalog[firstCat]?.[0] : undefined;
            if (firstCat && firstCode) {
                socket.emit('updateSelectedDecks', {
                    lobbyCode: lobbyCode!,
                    selected: { [firstCat]: [firstCode] },
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
                showToast(t.lobby.toasts.promoted, 'success', 4000);
            } else if (newHost) {
                showToast(t.lobby.toasts.newHost(newHost.name), 'info', 4000);
            }
        }
        prevHostIdRef.current = newHostId;

        setPlayers(data.players);
        const potentialCurrentPlayer = data.players.find((p: IPlayer) => p.socketId === socket.id);
        if (potentialCurrentPlayer) {
            setCurrentPlayer(potentialCurrentPlayer);
        }
    }, [showToast, t]);

    const handleJoinedLobby = useCallback((data: { player: IPlayer }) => {
        setCurrentPlayer(data.player);
    }, []);

    const handleKickedFromLobby = useCallback((data?: { hostName?: string }) => {
        const message = data?.hostName
            ? t.lobby.toasts.kicked(data.hostName)
            : t.lobby.toasts.kickedAnon;
        showToast(message, 'error', 4500);
        navigate('/');
    }, [navigate, showToast, t]);

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
        showToast(t.lobby.toasts.closedInactive, 'error', 4500);
        navigate('/');
    }, [navigate, showToast, t]);

    // Payloads typés via le contrat serveur (ServerToClientEvents) plutôt qu'inline :
    // ajouter/retirer un champ côté serveur force la mise à jour ici (sinon erreur de typecheck).
    const handleLobbyDecksState = useCallback((data: Parameters<ServerToClientEvents['lobbyDecksState']>[0]) => {
        setDecksCatalog(data.catalog);
        setDecksCatalogMeta(data.catalogWithMeta);
        setSelectedDecks(data.selected);
        setGuessMyAnswerMode(data.guessMyAnswerMode);
        setTimeMultiplier(data.timeMultiplier);
    }, []);

    const handleGuessMyAnswerModeUpdated = useCallback((data: Parameters<ServerToClientEvents['guessMyAnswerModeUpdated']>[0]) => {
        setGuessMyAnswerMode(data.guessMyAnswerMode);
    }, []);

    const handleTimeMultiplierUpdated = useCallback((data: Parameters<ServerToClientEvents['timeMultiplierUpdated']>[0]) => {
        setTimeMultiplier(data.timeMultiplier);
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

    const handleTimeMultiplierChange = useCallback((next: number) => {
        setTimeMultiplier(next);
        if (!lobbyCode) return;
        queueSettingEmit('timeMultiplier', () => {
            socket.emit('updateTimeMultiplier', { lobbyCode, timeMultiplier: next });
        });
    }, [lobbyCode, queueSettingEmit]);

    const handleSelectedDecksChange = useCallback((next: SelectedDecks) => {
        setSelectedDecks(next);
        if (!lobbyCode) return;
        queueSettingEmit('selectedDecks', () => {
            socket.emit('updateSelectedDecks', { lobbyCode, selected: next });
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
    useSocketEvent('timeMultiplierUpdated', handleTimeMultiplierUpdated, [handleTimeMultiplierUpdated]);

    const activePlayers = players.filter(p => p.isActive);
    const hostName = players.find(p => p.isHost)?.name ?? t.lobby.hostFallback;
    const enoughPlayers = activePlayers.length >= GAME_CONFIG.MIN_PLAYERS;
    const totalThemesSelected = Object.values(selectedDecks).reduce((acc, arr) => acc + arr.length, 0);
    const hasThemeSelected = totalThemesSelected > 0;
    const decksLoading = Object.keys(decksCatalog).length === 0;
    const canStartGame = enoughPlayers && hasThemeSelected;

    // Liste des joueurs - mobile : 3/ligne, desktop : 4/ligne (même format carré)
    const playersListMobile = (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
                <p className="m-0 font-display font-bold text-sm text-gray-800">{t.lobby.inTheRoom}</p>
                <p className="m-0 text-xs text-gray-400">{t.lobby.connectedCount(activePlayers.length)}</p>
            </div>
            <ul className="list-none w-full m-0 p-0 grid grid-cols-3 md:grid-cols-4 gap-2">
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

    const settingsPanelEl = (
        <div className="flex flex-col gap-4">
            {!isHost && (
                <div className="flex justify-center pt-4 pb-1">
                    <div className="relative rotate-[-1.2deg] hover:rotate-0 transition-transform duration-300 ease-out">
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cream-kraft border-[2.5px] border-black rounded-lg stack-shadow-sm texture-paper">
                            <span className="font-display text-[13px] tracking-tight text-black leading-snug whitespace-nowrap">
                                {t.lobby.settingsHostOnlyPrefix}{' '}
                                <span className="relative inline-block font-bold uppercase bg-black text-warning-500 px-1.5 py-0.5 rounded-md">
                                    <Icon
                                        icon="fluent-emoji-flat:crown"
                                        width={20}
                                        height={20}
                                        aria-hidden
                                        className="absolute -top-3.5 left-1/2 -translate-x-1/2"
                                        style={{ filter: STICKER_FILTER }}
                                    />
                                    {hostName && hostName.length > 10 ? `${hostName.slice(0, 10)}…` : hostName}
                                </span>{' '}
                                {t.lobby.settingsHostOnlySuffix}
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
            {/* Mode "Devine ma réponse" - décoché = mode Classique */}
            <Checkbox
                checked={guessMyAnswerMode}
                onChange={handleGuessMyAnswerModeChange}
                disabled={!isHost}
                label={t.lobby.guessMyAnswer.label}
                description={t.lobby.guessMyAnswer.description}
            />

            <span aria-hidden className="w-full border-t-[1.5px] border-dashed border-black/15" />

            {/* Rythme de jeu : slider 3 niveaux, emoji carousel, section inline. */}
            <GameSpeedSlider
                value={timeMultiplier}
                onChange={handleTimeMultiplierChange}
                disabled={!isHost}
                estimateFor={(m) => estimateGameMinutes(
                    Math.max(GAME_CONFIG.MIN_PLAYERS, activePlayers.length),
                    m,
                    guessMyAnswerMode,
                )}
                t={t}
            />

            <span aria-hidden className="w-full border-t-[1.5px] border-dashed border-black/15" />

            {/* Section Thèmes - titre + bloc blanc (compteur top-left, Modifier top-right, chips). */}
            <div className="flex flex-col gap-1.5">
                <span className="font-display text-base font-bold uppercase tracking-tight text-black px-1">
                    {t.lobby.themes}
                </span>
                <button
                    type="button"
                    onClick={() => setIsThemePickerOpen(true)}
                    aria-label={isHost ? t.themePicker.modify : t.themePicker.view}
                    className="group w-full flex flex-col gap-2 p-3 rounded-2xl border-[2.5px] border-black bg-white stack-shadow-sm text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-[1px] active:[box-shadow:none!important]"
                >
                    {/* En-tête du bloc : compteur top-left, Modifier/Voir top-right */}
                    <span className="flex items-center gap-2 w-full">
                        <span className="font-display text-xs font-bold tabular-nums text-black/60 whitespace-nowrap">
                            {t.themePicker.counter(totalThemesSelected)}
                        </span>
                        <span className="flex-1" />
                        <span className="shrink-0 inline-flex items-center gap-0.5 font-display text-xs font-bold uppercase tracking-tight text-black/75 group-hover:text-black transition-colors">
                            {isHost ? t.themePicker.modify : t.themePicker.view}
                            <Icon icon="lucide:chevron-right" width={16} height={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </span>
                    </span>

                    {/* Séparateur pointillé */}
                    <span aria-hidden className="w-full border-t-[1.5px] border-dashed border-black/15" />

                    {/* Chips des thèmes sélectionnés */}
                    <span className="flex flex-wrap items-center gap-1.5 min-h-[1.75rem]">
                        {totalThemesSelected === 0 ? (
                            <span className="font-display text-sm italic text-gray-500 px-1">{t.themePicker.emptyState}</span>
                        ) : (
                            Object.entries(decksCatalogMeta).flatMap(([cat, infos]) =>
                                infos
                                    .filter(info => selectedDecks[cat]?.includes(info.code))
                                    .map(info => (
                                        <span
                                            key={info.code}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-[2px] border-black font-display text-xs font-bold tracking-tight text-black"
                                            style={{ backgroundColor: getSoftCategoryColor(cat) }}
                                        >
                                            <Icon
                                                icon={info.emoji}
                                                width={14}
                                                height={14}
                                                aria-hidden
                                                style={{ filter: STICKER_FILTER }}
                                            />
                                            <span>{info.name}</span>
                                        </span>
                                    ))
                            )
                        )}
                    </span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="relative h-full flex flex-col overflow-hidden animate-phase-enter">
            {/* Logo desktop uniquement - positionné absolu pour ne pas perturber le centrage vertical.
                tablet: (pas md:) pour l'exclure des téléphones en paysage (largeur >768px mais hauteur basse). */}
            <div className="hidden tablet:flex absolute top-0 left-0 right-0 justify-center pointer-events-none z-0">
                <Logo size="small" />
            </div>
            {/* Zone centrale qui prend toute la place dispo et centre le contenu.
                Le Footer (en dessous) reste collé au bas de l'écran sur desktop. */}
            <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-hidden">
                {/* Contenu principal - sized to content, centré dans la fenêtre.
                Le panel a son propre cap dvh pour scroller si le contenu dépasse. */}
                <div className="w-full max-w-2xl md:max-w-3xl max-h-full min-h-0 mx-auto px-3 md:px-4 py-2 md:py-4 flex flex-col safe-pt">
                    {/* ===================== LAYOUT UNIFIÉ ===================== */}
                    <div className="min-h-0 flex flex-col gap-2 md:gap-4">
                        {/* Bouton retour + raccourci "Comment jouer ?" sur la même ligne. */}
                        <div className="shrink-0 flex items-center justify-between gap-2">
                            <BackButton onClick={leaveLobby} label={t.common.back} tone="danger" />
                            <HowToPlayButton onClick={() => setIsHowToPlayOpen(true)} />
                        </div>

                        {/* Tabs : intercalaires cartonnés en éventail, coins asymétriques */}
                        <div className="shrink-0 flex gap-1 md:gap-1.5 -mb-[2.5px] relative z-10 px-1">
                            {([
                                {
                                    id: 'settings' as const,
                                    color: 'var(--color-warning-500)',
                                    label: t.lobby.tabs.settings,
                                    badge: null,
                                    outer: 'left' as const,
                                },
                                {
                                    id: 'players' as const,
                                    color: 'var(--color-brand-500)',
                                    label: t.lobby.tabs.players,
                                    badge: `${activePlayers.length}/${GAME_CONFIG.MAX_PLAYERS}`,
                                    outer: 'right' as const,
                                },
                            ]).map(tab => {
                                const active = lobbyTab === tab.id;
                                // Coin "extérieur" généreusement arrondi (bord du panel),
                                // coin "intérieur" (entre les deux tabs) légèrement biseauté.
                                const radiusClasses = tab.outer === 'left'
                                    ? 'rounded-tl-[22px] rounded-tr-md'
                                    : 'rounded-tr-[22px] rounded-tl-md';
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setLobbyTab(tab.id)}
                                        className={`flex-1 relative inline-flex items-center justify-center gap-2 px-3 md:px-4 pt-2 md:pt-2.5 pb-3 md:pb-3.5 bg-white ${radiusClasses} border-[2.5px] border-b-0 border-black cursor-pointer transition-all duration-200 origin-bottom overflow-hidden
                                        ${active
                                                ? 'shadow-[3px_-3px_0_0_rgba(0,0,0,0.18)] z-20'
                                                : 'translate-y-1 hover:translate-y-0 z-10 opacity-90 hover:opacity-100'}
                                    `}
                                    >
                                        {/* Bande accent inférieure colorée - plus haute si actif */}
                                        <span
                                            className={`absolute left-0 right-0 bottom-0 pointer-events-none transition-[height] duration-200 ${active ? 'h-2 md:h-2.5' : 'h-1.5'}`}
                                            style={{ backgroundColor: tab.color }}
                                            aria-hidden
                                        />

                                        <span
                                            className={`relative font-display font-bold tracking-[0.08em] uppercase text-sm md:text-base ${active ? 'text-black' : 'text-gray-600'
                                                }`}
                                        >
                                            {tab.label}
                                        </span>

                                        {tab.badge && (
                                            <span
                                                className={`relative shrink-0 font-display text-[11px] md:text-xs font-bold tabular-nums whitespace-nowrap bg-white/80 rounded-full px-2 py-0.5 border border-black/15 ${active ? 'text-black/85' : 'text-black/60'
                                                    }`}
                                            >
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Panel de la tab active - sized to content, capé en dvh pour scroller
                        si le contenu dépasse (settings dense ou liste de joueurs >9). */}
                        <div
                            key={lobbyTab}
                            className="relative min-h-0 bg-white border-[2.5px] border-black rounded-2xl stack-shadow texture-paper overflow-hidden animate-phase-enter"
                        >
                            <div
                                ref={lobbyTabScrollRef}
                                role="tabpanel"
                                className="max-h-[67dvh] overflow-y-auto overscroll-contain no-scrollbar px-4 pb-4 pt-6 md:px-5 md:pb-5 md:pt-7"
                            >
                                {/* Grid stacking : settings est toujours rendu (visible
                                ou non) pour dicter la hauteur ; players se cale
                                dans la même cellule de grille. */}
                                <div className="grid grid-cols-1 grid-rows-1">
                                    <div
                                        className={`col-start-1 row-start-1 ${lobbyTab === 'settings' ? '' : 'invisible pointer-events-none'}`}
                                        aria-hidden={lobbyTab !== 'settings'}
                                    >
                                        {settingsPanelEl}
                                    </div>
                                    <div
                                        className={`col-start-1 row-start-1 ${lobbyTab === 'players' ? '' : 'invisible pointer-events-none'}`}
                                        aria-hidden={lobbyTab !== 'players'}
                                    >
                                        {playersListMobile}
                                    </div>
                                </div>
                            </div>
                            <ScrollFade scrollRef={lobbyTabScrollRef} className="rounded-b-2xl" />
                        </div>

                        {/* ===================== ACTION ROW : Démarrer + Partager l'invitation ===================== */}
                        <div className="shrink-0 flex flex-col items-center gap-1.5 mt-1 md:mt-2 safe-pb">
                            <div className="flex flex-row items-center justify-center gap-3 md:gap-4 w-full flex-wrap">
                                {currentPlayer?.isHost ? (
                                    <Button
                                        text={t.lobby.start}
                                        variant="success"
                                        size="md"
                                        hero
                                        disabled={!canStartGame}
                                        onClick={startGame}
                                        className="!rotate-0"
                                    />
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/85 border-[2.5px] border-black stack-shadow-sm text-gray-700">
                                        <Icon icon="fluent-emoji-flat:hourglass-not-done" className="animate-spin-slow [filter:drop-shadow(1px_1.5px_0_rgba(0,0,0,0.5))]" width="1.1em" height="1.1em" aria-hidden />
                                        <span className="text-sm font-display italic truncate">{t.lobby.startHostOnly(hostName && hostName.length > 10 ? `${hostName.slice(0, 10)}…` : hostName)}</span>
                                    </div>
                                )}
                                <Button
                                    text={t.lobby.shareInvite.button}
                                    variant="warning"
                                    size="sm"
                                    className="!text-xs md:!text-sm whitespace-nowrap"
                                    onClick={shareInvite}
                                />
                            </div>

                            {/* Helper text sous l'action row */}
                            {currentPlayer?.isHost && !enoughPlayers && (
                                <small className="text-[11px] md:text-xs text-white/85 italic drop-shadow text-center">
                                    {t.lobby.minPlayers(GAME_CONFIG.MIN_PLAYERS)}
                                </small>
                            )}
                            {currentPlayer?.isHost && enoughPlayers && !hasThemeSelected && (
                                <small className="text-[11px] md:text-xs text-white/85 italic drop-shadow text-center">
                                    {decksLoading ? t.lobby.loadingThemes : t.lobby.selectAtLeastOneTheme}
                                </small>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer transparent en overlay (desktop uniquement) : ne mange pas
                la place verticale, le contenu peut passer dessous. */}
            <div className="hidden md:block absolute bottom-0 left-0 right-0 pointer-events-none z-10">
                <div className="pointer-events-auto">
                    <Footer />
                </div>
            </div>

            {/* Modal de confirmation pour peu de joueurs */}
            <ConfirmModal
                isOpen={showFewPlayersModal}
                onClose={() => setShowFewPlayersModal(false)}
                onConfirm={doStartGame}
                title={t.lobby.modals.fewPlayers.title}
                message={t.lobby.modals.fewPlayers.message}
                confirmText={t.lobby.modals.fewPlayers.confirm}
                cancelText={t.lobby.modals.fewPlayers.cancel}
                confirmVariant="success"
            />

            {/* Modal partie déjà commencée */}
            <InfoModal
                isOpen={showGameAlreadyStarted}
                onClose={() => {
                    setShowGameAlreadyStarted(false);
                    navigate('/');
                }}
                title={t.lobby.modals.alreadyStarted.title}
            >
                <div className="text-center space-y-4">
                    <Icon icon="fluent-emoji-flat:crying-face" className="mx-auto" width="4rem" height="4rem" aria-hidden style={{ filter: STICKER_FILTER }} />
                    <p className="text-gray-700">
                        {t.lobby.modals.alreadyStarted.body}
                    </p>
                    <p className="text-sm text-gray-500 italic">
                        {t.lobby.modals.alreadyStarted.tip}
                    </p>
                </div>
            </InfoModal>

            {/* Modal "Comment jouer ?" */}
            <InfoModal
                isOpen={isHowToPlayOpen}
                onClose={() => setIsHowToPlayOpen(false)}
                title={t.lobby.modals.howToPlay}
            >
                <HowToPlayCarousel />
            </InfoModal>

            {/* Modal fallback : affiche le lien quand le copier-coller automatique a échoué */}
            <InfoModal
                isOpen={fallbackLink !== null}
                onClose={() => setFallbackLink(null)}
                title={t.lobby.modals.copyLink.title}
            >
                <div className="space-y-3">
                    <p className="text-sm text-gray-700 m-0">
                        {t.lobby.modals.copyLink.body}
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

            {/* Modal de sélection des thèmes (édition pour host, lecture seule sinon) */}
            <ThemePickerModal
                isOpen={isThemePickerOpen}
                onClose={() => setIsThemePickerOpen(false)}
                catalog={decksCatalogMeta}
                selected={selectedDecks}
                mode={isHost ? 'edit' : 'readonly'}
                hostName={hostName}
                onChange={handleSelectedDecksChange}
            />
        </div>
    );
};

export default Lobby;
