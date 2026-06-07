import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import socket from '../utils/socket';
import Button from '../components/Button';
import Logo from '../components/Logo';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import InfoModal from '../components/InfoModal';
import HowToPlayCarousel from '../components/HowToPlayCarousel';
import HowToPlayButton from '../components/HowToPlayButton';
import { Icon } from '@iconify/react';
import ThemePickerModal from '../components/ThemePickerModal';
import BackButton from '../components/BackButton';
import ScrollFade from '../components/ScrollFade';
import LobbyTabs, { type LobbyTabId } from '../components/lobby/LobbyTabs';
import LobbyPlayersGrid from '../components/lobby/LobbyPlayersGrid';
import LobbySettingsPanel from '../components/lobby/LobbySettingsPanel';
import { IPlayer, ERROR_CODES } from '@onskone/shared';
import type { ErrorCode } from '@onskone/shared';
import { useSocketEvent, useLeavePrompt, useReconnectOnVisible } from '../hooks';
import { useLobbyIdentity } from '../hooks/useLobbyIdentity';
import { useShareInvite } from '../hooks/useShareInvite';
import { useLobbyState } from '../hooks/useLobbyState';
import { useLobbyExitEvents } from '../hooks/useLobbyExitEvents';
import { useToast } from '../components/Toast';
import { useLocale } from '../i18n';
import { GAME_CONFIG } from '../constants/game';
import { STICKER_FILTER } from '../constants/icons';
import { studioStorage, isStudioFrame } from '../utils/studioStorage';

const RECOMMENDED_PLAYERS = 4;

const Lobby = () => {
    const { lobbyCode } = useParams<{ lobbyCode: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const showToast = useToast();
    const { t } = useLocale();

    // Redirige vers l'accueil si aucun code de lobby
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
    const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
    const [lobbyTab, setLobbyTab] = useState<LobbyTabId>('settings');
    const lobbyTabScrollRef = useRef<HTMLDivElement | null>(null);
    // Le scroll-container est partagé entre les 2 tabs (grid stacking).
    // Reset à 0 au switch pour éviter que la position scrollée des settings
    // contamine la vue Players (et que le ScrollFade reflète un mauvais état).
    useEffect(() => {
        const el = lobbyTabScrollRef.current;
        if (el) el.scrollTop = 0;
    }, [lobbyTab]);
    const initialPlayerIdsRef = useRef<Set<string> | null>(null);
    const prevHostIdRef = useRef<string | null>(null);

    const { playerName, avatarId } = useLobbyIdentity(lobbyCode, searchParams);

    // Réglages du lobby (thèmes, mode, rythme) + leur synchro socket.
    const {
        decksCatalog,
        decksCatalogMeta,
        selectedDecks,
        guessMyAnswerMode,
        timeMultiplier,
        onGuessMyAnswerModeChange,
        onTimeMultiplierChange,
        onSelectedDecksChange,
    } = useLobbyState(lobbyCode);

    // Partage de l'invitation (cascade native/Web Share/copie + modale de repli).
    const { shareInvite, fallbackLink, clearFallbackLink } = useShareInvite(lobbyCode, t);

    // Avertissement avant de quitter la page (le serveur gère la déconnexion automatiquement via socket.disconnect)
    useLeavePrompt(!!currentPlayer);

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

    // Studio : si cette iframe est le bot hôte ET qu'on a atteint le nombre de
    // joueurs recommandé, démarre la partie automatiquement. Réarmé une fois par visite du lobby.
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
        // Il faut un thème sélectionné : si rien n'est présélectionné, on prend
        // le premier thème disponible du catalogue.
        if (Object.values(selectedDecks).reduce((acc, arr) => acc + arr.length, 0) === 0) {
            const firstCat = Object.keys(decksCatalog)[0];
            const firstCode = firstCat ? decksCatalog[firstCat]?.[0] : undefined;
            if (firstCat && firstCode) {
                socket.emit('updateSelectedDecks', {
                    lobbyCode: lobbyCode!,
                    selected: { [firstCat]: [firstCode] },
                });
                return; // attend la maj d'état, réessaiera au prochain run de l'effet
            }
            return;
        }
        studioAutoStartedRef.current = true;
        const timer = setTimeout(() => {
            socket.emit('startGame', { lobbyCode: lobbyCode! });
        }, 1200);
        return () => clearTimeout(timer);
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

    // Routing d'erreur sur le `code` stable du contrat ; fallback sur le
    // texte localisé pour les serveurs qui n'émettent pas encore de code.
    const handleError = useCallback((data: { message: string; code?: ErrorCode }) => {
        const isNotFound = data.code
            ? data.code === ERROR_CODES.NOT_FOUND
            : data.message === 'Lobby not found' || data.message === 'Player not found';
        if (isNotFound) {
            navigate('/');
            return;
        }
        console.error('Error:', data.message);
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

    useSocketEvent('updatePlayersList', handleUpdatePlayersList);
    useSocketEvent('joinedLobby', handleJoinedLobby);
    useSocketEvent('error', handleError);
    useSocketEvent('gameStarted', handleGameStarted);
    useSocketEvent('gameAlreadyStarted', handleGameAlreadyStarted);

    // Éjection vers l'accueil (kick par l'hôte / fermeture du salon) — logique
    // partagée avec Game.
    useLobbyExitEvents(navigate, t);

    const activePlayers = players.filter(p => p.isActive);
    const hostName = players.find(p => p.isHost)?.name ?? t.lobby.hostFallback;
    const enoughPlayers = activePlayers.length >= GAME_CONFIG.MIN_PLAYERS;
    const totalThemesSelected = Object.values(selectedDecks).reduce((acc, arr) => acc + arr.length, 0);
    const hasThemeSelected = totalThemesSelected > 0;
    const decksLoading = Object.keys(decksCatalog).length === 0;
    const canStartGame = enoughPlayers && hasThemeSelected;
    const isHost = !!currentPlayer?.isHost;

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
                        <LobbyTabs
                            activeTab={lobbyTab}
                            onTabChange={setLobbyTab}
                            activePlayersCount={activePlayers.length}
                            t={t}
                        />

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
                                        <LobbySettingsPanel
                                            isHost={isHost}
                                            hostName={hostName}
                                            guessMyAnswerMode={guessMyAnswerMode}
                                            onGuessMyAnswerModeChange={onGuessMyAnswerModeChange}
                                            timeMultiplier={timeMultiplier}
                                            onTimeMultiplierChange={onTimeMultiplierChange}
                                            activePlayersCount={activePlayers.length}
                                            selectedDecks={selectedDecks}
                                            decksCatalogMeta={decksCatalogMeta}
                                            totalThemesSelected={totalThemesSelected}
                                            onOpenThemePicker={() => setIsThemePickerOpen(true)}
                                            t={t}
                                        />
                                    </div>
                                    <div
                                        className={`col-start-1 row-start-1 ${lobbyTab === 'players' ? '' : 'invisible pointer-events-none'}`}
                                        aria-hidden={lobbyTab !== 'players'}
                                    >
                                        <LobbyPlayersGrid
                                            players={players}
                                            currentPlayer={currentPlayer}
                                            initialPlayerIds={initialPlayerIdsRef.current}
                                            activePlayersCount={activePlayers.length}
                                            onKick={kickPlayer}
                                            onPromote={promotePlayer}
                                            t={t}
                                        />
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
                onClose={clearFallbackLink}
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
                        aria-label={t.lobby.modals.copyLink.title}
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
                onChange={onSelectedDecksChange}
            />
        </div>
    );
};

export default Lobby;
