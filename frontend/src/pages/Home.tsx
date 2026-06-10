import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import PseudoPlate from '../components/PseudoPlate';
import Footer from '../components/Footer';
import AvatarSelector from '../components/AvatarSelector';
import InfoModal from '../components/InfoModal';
import GameModeModal from '../components/GameModeModal';
import HowToPlayCarousel from '../components/HowToPlayCarousel';
import HowToPlayButton from '../components/HowToPlayButton';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLocale } from '../i18n';
import { useToast } from '../components/Toast';
import type { Locale } from '@onskone/shared';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { useSocketEvent } from '../hooks';
import { GameMode } from '@onskone/shared';
import { GAME_CONFIG, AVATARS } from '../constants/game';
import { STICKER_FILTER } from '../constants/icons';
import {
  getStats,
  rememberIdentity,
  ACHIEVEMENTS,
  getUnseenAchievementIds,
  markAchievementsAsSeen,
} from '../utils/playerStats';
import { storeReconnectToken } from '../utils/playerHelpers';

const Home = () => {
  const { locale, t } = useLocale();
  // Pré-remplit depuis le profil persistant (lazy init -> 1 lecture localStorage).
  const initialStats = (() => {
    try { return getStats(); } catch { return null; }
  })();
  const [playerName, setPlayerName] = useState<string>(initialStats?.lastPseudo || '');
  const [avatarId, setAvatarId] = useState<number>(
    initialStats?.lastAvatarId !== null && initialStats?.lastAvatarId !== undefined
      ? initialStats.lastAvatarId
      : Math.floor(Math.random() * AVATARS.length)
  );
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isGameModeOpen, setIsGameModeOpen] = useState(false);
  const [unseenAchievementIds, setUnseenAchievementIds] = useState<string[]>(() => {
    try { return getUnseenAchievementIds(); } catch { return []; }
  });
  // Snapshot des succès "nouveaux" au moment où la modale s'ouvre -> drive l'animation des lignes.
  const [highlightedAchievementIds, setHighlightedAchievementIds] = useState<Set<string>>(new Set());
  const [hostName, setHostName] = useState<string | null>(null);
  const [lobbyExists, setLobbyExists] = useState<boolean | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const lobbyCode = searchParams.get('lobbyCode');
  const urlPlayerName = searchParams.get('playerName');
  const urlAvatarId = searchParams.get('avatarId');
  const autoCreate = searchParams.get('autoCreate') === '1';
  const autoJoin = searchParams.get('autoJoin') === '1';

  // Studio : pré-remplit l'identité depuis les params d'URL pour que les iframes n'aient pas besoin de saisie.
  useEffect(() => {
    if (urlPlayerName && !playerName) setPlayerName(urlPlayerName);
    if (urlAvatarId !== null) {
      const id = parseInt(urlAvatarId, 10);
      if (!isNaN(id)) setAvatarId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Récupère les infos du lobby quand un code est présent dans l'URL
  useEffect(() => {
    if (lobbyCode) {
      socket.emit('getLobbyInfo', { lobbyCode });
    }
  }, [lobbyCode]);

  // Studio : création auto du lobby (slot 0 / hôte).
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!autoCreate || lobbyCode) return;
    const name = urlPlayerName || playerName;
    if (!name?.trim()) return;
    autoFiredRef.current = true;
    const studioGameMode = searchParams.get('studioGameMode');
    const mode: GameMode = studioGameMode === 'remote' ? 'remote' : 'local';
    socket.emit('createLobby', { playerName: name, avatarId, gameMode: mode, locale });
  }, [autoCreate, lobbyCode, urlPlayerName, playerName, avatarId, searchParams, locale]);

  // Studio : jointure auto d'un lobby existant (slot 1+).
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!autoJoin || !lobbyCode || lobbyExists !== true) return;
    const name = urlPlayerName || playerName;
    if (!name?.trim()) return;
    autoFiredRef.current = true;
    socket.emit('checkPlayerName', { lobbyCode, playerName: name });
  }, [autoJoin, lobbyCode, lobbyExists, urlPlayerName, playerName]);

  const createLobby = useCallback(() => {
    if (!playerName.trim()) {
      showToast(t.home.toasts.enterPseudoCreate, 'warning');
      return;
    }
    setIsGameModeOpen(true);
  }, [playerName, showToast, t]);

  const handleGameModeSelected = useCallback((mode: GameMode, deckLocale: Locale) => {
    setIsGameModeOpen(false);
    rememberIdentity(playerName, avatarId);
    socket.emit('createLobby', { playerName, avatarId, gameMode: mode, locale: deckLocale });
  }, [playerName, avatarId]);

  const joinLobby = useCallback(() => {
    if (!playerName.trim()) {
      showToast(t.home.toasts.enterPseudoJoin, 'warning');
      return;
    }
    if (!lobbyCode) {
      showToast(t.home.toasts.invalidLobbyCode, 'error');
      return;
    }
    rememberIdentity(playerName, avatarId);
    socket.emit('checkPlayerName', { lobbyCode, playerName });
  }, [lobbyCode, playerName, avatarId, showToast, t]);

  const handleLobbyCreated = useCallback((data: { lobbyCode: string; reconnectToken: string }) => {
    // Stocker le secret de reconnexion du host (émis à son seul socket) avant de
    // naviguer vers le lobby : il sera renvoyé lors des reconnexions ultérieures.
    storeReconnectToken(data.lobbyCode, data.reconnectToken);
    // Studio : prévient la fenêtre parente que le lobby existe pour que les iframes voisines puissent rejoindre auto.
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'studio:lobbyCreated', lobbyCode: data.lobbyCode }, '*');
      } catch { /* silent */ }
    }
    // Studio: appliquer le multiplicateur de temps choisi dans la toolbar. Le créateur
    // est l'hôte et déjà dans la room, donc le handler host-only passe.
    const studioMult = searchParams.get('studioTimeMultiplier');
    if (studioMult !== null) {
      const m = Number(studioMult);
      if (Number.isFinite(m)) {
        socket.emit('updateTimeMultiplier', { lobbyCode: data.lobbyCode, timeMultiplier: m });
      }
    }
    const name = urlPlayerName || playerName;
    navigate(`/lobby/${data.lobbyCode}?playerName=${encodeURIComponent(name)}&avatarId=${avatarId}`);
  }, [navigate, playerName, urlPlayerName, avatarId, searchParams]);

  const handlePlayerNameExists = useCallback((data: { playerName: string }) => {
    showToast(t.home.toasts.pseudoTaken(data.playerName), 'warning');
  }, [showToast, t]);

  const handlePlayerNameValid = useCallback(() => {
    const name = urlPlayerName || playerName;
    navigate(`/lobby/${lobbyCode}?playerName=${encodeURIComponent(name)}&avatarId=${avatarId}`);
  }, [navigate, lobbyCode, playerName, urlPlayerName, avatarId]);

  const openStats = useCallback(() => {
    // On capture la snapshot AVANT de marquer comme vus, pour pouvoir animer les lignes concernées.
    const fresh = unseenAchievementIds;
    if (fresh.length > 0) {
      markAchievementsAsSeen();
      setHighlightedAchievementIds(new Set(fresh));
      setUnseenAchievementIds([]);
    } else {
      setHighlightedAchievementIds(new Set());
    }
    setIsStatsOpen(true);
  }, [unseenAchievementIds]);

  const closeStats = useCallback(() => {
    setIsStatsOpen(false);
    setHighlightedAchievementIds(new Set());
  }, []);

  const handleError = useCallback((data: { message: string }) => {
    console.error('Erreur:', data.message);
    showToast(data.message, 'error');
  }, [showToast]);

  const handleLobbyInfo = useCallback((data: { exists: boolean; hostName?: string | null }) => {
    setLobbyExists(data.exists);
    if (data.exists && data.hostName) {
      setHostName(data.hostName);
    } else if (!data.exists) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useSocketEvent('lobbyInfo', handleLobbyInfo);
  useSocketEvent('lobbyCreated', handleLobbyCreated);
  useSocketEvent('playerNameExists', handlePlayerNameExists);
  useSocketEvent('playerNameValid', handlePlayerNameValid);
  useSocketEvent('error', handleError);

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="absolute top-3 right-3 z-30 safe-pt">
        <LanguageSwitcher />
      </div>

      {/* Modal d'information */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title={t.home.howToPlayHeading}
        disableScrollFade
      >
        <HowToPlayCarousel />
      </InfoModal>

      <GameModeModal
        isOpen={isGameModeOpen}
        onClose={() => setIsGameModeOpen(false)}
        onSelect={handleGameModeSelected}
      />

      <InfoModal
        isOpen={isStatsOpen}
        onClose={closeStats}
        title={t.home.achievementsTitle}
      >
        {(() => {
          const stats = getStats();
          const unlocked = new Set(stats.unlockedAchievements);
          return (
            <div className="flex flex-col gap-3 pb-10">
              {/* Stats top : chiffres modestes + labels lisibles, pour éviter un contraste de taille trop disproportionné. */}
              <div className="grid grid-cols-2 gap-2 text-center mb-1">
                <div className="bg-cream-player border-2 border-black rounded-xl p-2 stack-shadow-sm">
                  <div className="text-lg font-display font-bold tabular-nums leading-none">{stats.gamesPlayed}</div>
                  <div className="text-[11px] font-display font-semibold text-gray-600 mt-1">{t.home.stats.gamesPlayed}</div>
                </div>
                <div className="bg-cream-player border-2 border-black rounded-xl p-2 stack-shadow-sm">
                  <div className="text-lg font-display font-bold tabular-nums leading-none">{stats.totalPoints}</div>
                  <div className="text-[11px] font-display font-semibold text-gray-600 mt-1">{t.home.stats.pointsScored}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = unlocked.has(ach.id);
                  // Succès caché non débloqué -> on masque titre/description/icône.
                  const isMystery = !!ach.hidden && !isUnlocked;
                  const isHighlighted = highlightedAchievementIds.has(ach.id);
                  const meta = t.achievements[ach.id];
                  // Stagger doux entre nouveaux succès pour qu'ils ne bondissent pas tous en même temps.
                  const highlightedOrder = isHighlighted
                    ? Array.from(highlightedAchievementIds).indexOf(ach.id)
                    : 0;
                  return (
                    <div
                      key={ach.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 border-black transition-all ${isUnlocked ? 'stack-shadow-sm bg-gradient-to-br from-warning-300 to-warning-orange' : 'bg-gray-100 opacity-60'} ${isHighlighted ? 'animate-achievement-unlock' : ''}`}
                      style={isHighlighted ? { animationDelay: `${0.15 + highlightedOrder * 0.12}s` } : undefined}
                    >
                      <div
                        className="flex-shrink-0"
                        style={{
                          filter: isUnlocked ? STICKER_FILTER : 'grayscale(1)',
                          opacity: isUnlocked ? 1 : 0.5,
                        }}
                      >
                        <Icon
                          icon={isMystery ? 'fluent-emoji-flat:white-question-mark' : ach.icon}
                          width={40}
                          height={40}
                          aria-hidden
                        />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-display font-bold text-sm text-gray-900 leading-tight">
                          {isMystery ? '???' : meta?.title ?? ach.id}
                        </div>
                        <div className={`text-xs leading-snug ${isUnlocked ? 'text-gray-800' : 'text-gray-600'}`}>
                          {isMystery ? '...' : meta?.description ?? ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </InfoModal>

      {/* Contenu principal */}
      <div className="flex-1 min-h-0 w-full max-w-screen-xl mx-auto px-4 py-4 desktop-short:py-1 flex flex-col justify-center md:justify-start pb-24 md:pb-4 overflow-y-auto overscroll-contain no-scrollbar safe-pt">
        {/* Logo - le wrapper ne porte plus de marge bas asymétrique ;
            la marge verticale (top = bot) est gérée par le <Logo> via son my-*,
            sinon en desktop-short (PC large mais court) le logo collait le haut. */}
        <div className="flex justify-center">
          <Logo size="large" />
        </div>

        {/* Grille responsive */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {/* Spacer gauche - desktop only */}
          <div className="hidden md:block md:col-span-1" />

          {/* Bloc "Joue maintenant" */}
          <div className="md:col-span-4 flex flex-col gap-2 relative">
            {lobbyCode && (
              <div className="absolute -top-7 left-0 z-10">
                <BackButton onClick={() => navigate('/')} label={t.home.exit} tone="danger" />
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={openStats}
                aria-label={
                  unseenAchievementIds.length > 0
                    ? t.home.aria.seeAchievementsWithNew(unseenAchievementIds.length)
                    : t.home.aria.seeAchievements
                }
                className="absolute top-3 right-3 z-10 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                <span
                  className="block"
                  style={{ filter: STICKER_FILTER }}
                >
                  <Icon
                    icon="fluent-emoji-flat:trophy"
                    width={22}
                    height={22}
                    aria-hidden
                  />
                </span>
                {unseenAchievementIds.length > 0 && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-danger-500 border-2 border-black animate-notification-pulse"
                  />
                )}
              </button>
              <Frame>
                {lobbyCode && lobbyExists ? (
                  <h3 className="text-sm md:text-base font-normal">{t.home.invite(hostName || t.home.fallbackFriend)}</h3>
                ) : (
                  <h3 className="font-accent text-display-lg">{t.home.playNow}</h3>
                )}
                <AvatarSelector
                  selectedAvatarId={avatarId}
                  onSelect={setAvatarId}
                />
                <div className="w-full px-2">
                  <PseudoPlate
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder={t.common.pseudoPlaceholderUpper}
                    maxLength={GAME_CONFIG.MAX_NAME_LENGTH}
                  />
                </div>
                {!lobbyCode ? (
                  <div className="text-center space-y-2">
                    <Button
                      text={t.home.createLobby}
                      variant="primary"
                      size="md"
                      onClick={createLobby}
                    />
                  </div>
                ) : lobbyExists === null ? (
                  <div className="text-center">
                    <span className="text-sm text-gray-500">{t.home.checking}</span>
                  </div>
                ) : (
                  <div>
                    <Button text={t.home.join} variant="warning" size="md" onClick={joinLobby} />
                  </div>
                )}
              </Frame>
            </div>

            {/* Bouton Comment jouer - mobile uniquement (PC: carousel inline à droite) */}
            <div className="md:hidden mt-2 flex justify-center">
              <HowToPlayButton onClick={() => setIsInfoOpen(true)} />
            </div>
          </div>

          {/* Bloc explications - desktop only (même carousel que la modale mobile) */}
          <div className="hidden md:block md:col-span-6">
            <Frame textAlign="left">
              <div className="w-full border-b-2 border-dashed border-gray-300 pb-3 mb-4 desktop-short:pb-1 desktop-short:mb-1 flex items-center gap-2">
                <Icon icon="fluent-emoji-flat:direct-hit" className="desktop-short:w-5 desktop-short:h-5" width={26} height={26} aria-hidden />
                <h2 className="marker-highlight font-accent text-display-lg desktop-short:text-display-md text-gray-900 m-0">
                  {t.home.howToPlayHeading}
                </h2>
              </div>
              <HowToPlayCarousel />
            </Frame>
          </div>

          {/* Spacer droit - desktop only */}
          <div className="hidden md:block md:col-span-1" />
        </div>
      </div>

      {/* Footer transparent en overlay : ne mange pas la place verticale,
          le contenu peut passer dessous. pointer-events-none sur le wrapper +
          auto sur le Footer pour garder les liens cliquables et laisser
          les zones vides traversables. */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10">
        <div className="pointer-events-auto">
          <Footer />
        </div>
      </div>

      {import.meta.env.DEV && window.self === window.top && (
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg bg-black/80 text-white text-xs font-display border-2 border-white/20 hover:bg-black hover:scale-105 transition-all stack-shadow-sm"
          title={t.home.studioButtonTitle}
        >
          🎬 Studio
        </button>
      )}
    </div>
  );
};

export default Home;
