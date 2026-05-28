import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import PseudoPlate from '../components/PseudoPlate';
import Footer from '../components/Footer';
import AvatarSelector from '../components/AvatarSelector';
import InfoModal from '../components/InfoModal';
import HowToPlayCarousel from '../components/HowToPlayCarousel';
import HowToPlayButton from '../components/HowToPlayButton';
import { useToast } from '../components/Toast';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { useSocketEvent, useQueryParams } from '../hooks';
import { GAME_CONFIG, AVATARS } from '../constants/game';
import {
  getStats,
  rememberIdentity,
  ACHIEVEMENTS,
  getUnseenAchievementIds,
  markAchievementsAsSeen,
} from '../utils/playerStats';

const Home = () => {
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
  const [unseenAchievementIds, setUnseenAchievementIds] = useState<string[]>(() => {
    try { return getUnseenAchievementIds(); } catch { return []; }
  });
  // Snapshot des succès "nouveaux" au moment où la modale s'ouvre -> drive l'animation des lignes.
  const [highlightedAchievementIds, setHighlightedAchievementIds] = useState<Set<string>>(new Set());
  const [hostName, setHostName] = useState<string | null>(null);
  const [lobbyExists, setLobbyExists] = useState<boolean | null>(null);
  const queryParams = useQueryParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const lobbyCode = queryParams.get('lobbyCode');
  const urlPlayerName = queryParams.get('playerName');
  const urlAvatarId = queryParams.get('avatarId');
  const autoCreate = queryParams.get('autoCreate') === '1';
  const autoJoin = queryParams.get('autoJoin') === '1';

  // Studio: pre-fill identity from URL params so iframes don't need user input.
  useEffect(() => {
    if (urlPlayerName && !playerName) setPlayerName(urlPlayerName);
    if (urlAvatarId !== null) {
      const id = parseInt(urlAvatarId, 10);
      if (!isNaN(id)) setAvatarId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch lobby info when there's a lobby code in URL
  useEffect(() => {
    if (lobbyCode) {
      socket.emit('getLobbyInfo', { lobbyCode });
    }
  }, [lobbyCode]);

  // Studio: auto-create lobby (slot 0 / host).
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!autoCreate || lobbyCode) return;
    const name = urlPlayerName || playerName;
    if (!name?.trim()) return;
    autoFiredRef.current = true;
    socket.emit('createLobby', { playerName: name, avatarId });
  }, [autoCreate, lobbyCode, urlPlayerName, playerName, avatarId]);

  // Studio: auto-join existing lobby (slot 1+).
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
      showToast('Entre ton pseudo avant de créer un salon', 'warning');
      return;
    }
    rememberIdentity(playerName, avatarId);
    socket.emit('createLobby', { playerName, avatarId });
  }, [playerName, avatarId, showToast]);

  const joinLobby = useCallback(() => {
    if (!playerName.trim()) {
      showToast('Entre ton pseudo avant de rejoindre un salon', 'warning');
      return;
    }
    if (!lobbyCode) {
      showToast('Code de salon invalide', 'error');
      return;
    }
    rememberIdentity(playerName, avatarId);
    socket.emit('checkPlayerName', { lobbyCode, playerName });
  }, [lobbyCode, playerName, avatarId, showToast]);

  const handleLobbyCreated = useCallback((data: { lobbyCode: string }) => {
    // Studio: notify parent window that the lobby exists so siblings can auto-join.
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'studio:lobbyCreated', lobbyCode: data.lobbyCode }, '*');
      } catch { /* silent */ }
    }
    const name = urlPlayerName || playerName;
    navigate(`/lobby/${data.lobbyCode}?playerName=${encodeURIComponent(name)}&avatarId=${avatarId}`);
  }, [navigate, playerName, urlPlayerName, avatarId]);

  const handlePlayerNameExists = useCallback((data: { playerName: string }) => {
    showToast(`Le pseudo "${data.playerName}" est déjà pris dans ce salon`, 'warning');
  }, [showToast]);

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

  useSocketEvent('lobbyInfo', handleLobbyInfo, [handleLobbyInfo]);
  useSocketEvent('lobbyCreated', handleLobbyCreated, [handleLobbyCreated]);
  useSocketEvent('playerNameExists', handlePlayerNameExists, [handlePlayerNameExists]);
  useSocketEvent('playerNameValid', handlePlayerNameValid, [handlePlayerNameValid]);
  useSocketEvent('error', handleError, [handleError]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Modal d'information */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title="Comment jouer ?"
        variant="comic"
        disableScrollFade
      >
        <HowToPlayCarousel />
      </InfoModal>

      <InfoModal
        isOpen={isStatsOpen}
        onClose={closeStats}
        title="Mes succès"
      >
        {(() => {
          const stats = getStats();
          const unlocked = new Set(stats.unlockedAchievements);
          return (
            <div className="flex flex-col gap-3 pb-10">
              {/* Stats top : chiffres + labels rééquilibrés (chiffres plus modestes,
                  labels plus lisibles - avant : text-xl vs text-[10px], trop disproportionné). */}
              <div className="grid grid-cols-2 gap-2 text-center mb-1">
                <div className="bg-cream-player border-2 border-black rounded-xl p-2 stack-shadow-sm">
                  <div className="text-lg font-display font-bold tabular-nums leading-none">{stats.gamesPlayed}</div>
                  <div className="text-[11px] font-display font-semibold text-gray-600 mt-1">Parties jouées</div>
                </div>
                <div className="bg-cream-player border-2 border-black rounded-xl p-2 stack-shadow-sm">
                  <div className="text-lg font-display font-bold tabular-nums leading-none">{stats.totalPoints}</div>
                  <div className="text-[11px] font-display font-semibold text-gray-600 mt-1">Points marqués</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = unlocked.has(ach.id);
                  // Succès caché non débloqué -> on masque titre/description/icône.
                  const isMystery = !!ach.hidden && !isUnlocked;
                  const isHighlighted = highlightedAchievementIds.has(ach.id);
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
                          filter: isUnlocked
                            ? 'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 2px 0 rgba(0,0,0,0.35))'
                            : 'grayscale(1)',
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
                          {isMystery ? '???' : ach.title}
                        </div>
                        <div className={`text-xs leading-snug ${isUnlocked ? 'text-gray-800' : 'text-gray-600'}`}>
                          {isMystery ? '...' : ach.description}
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
      <div className="flex-1 min-h-0 w-full max-w-screen-xl mx-auto px-4 py-4 md:py-4 flex flex-col justify-center md:justify-start overflow-y-auto overscroll-contain no-scrollbar safe-pt">
        {/* Logo */}
        <div className="flex justify-center mb-4 md:mb-8">
          <Logo size="large" />
        </div>

        {/* Grille responsive */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {/* Spacer gauche - desktop only */}
          <div className="hidden md:block md:col-span-1" />

          {/* Bloc "Joue maintenant" */}
          <div className="md:col-span-4 flex flex-col gap-2">
            {lobbyCode && (
              <BackButton onClick={() => navigate('/')} label="Quitter" tone="danger" />
            )}
            <div className="relative">
              <button
                type="button"
                onClick={openStats}
                aria-label={
                  unseenAchievementIds.length > 0
                    ? `Voir mes succès (${unseenAchievementIds.length} nouveau${unseenAchievementIds.length > 1 ? 'x' : ''})`
                    : 'Voir mes succès'
                }
                className="absolute top-3 right-3 z-10 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              >
                <span
                  className="block"
                  style={{
                    filter:
                      'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 2px 0 rgba(0,0,0,0.35))',
                  }}
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
                  <h3 className="text-sm md:text-base font-normal"><b className="font-bold">{hostName || 'Un ami'}</b> t'invite à rejoindre son salon !</h3>
                ) : (
                  <h3 className="font-accent text-display-lg">Joue maintenant !</h3>
                )}
                <AvatarSelector
                  selectedAvatarId={avatarId}
                  onSelect={setAvatarId}
                />
                <div className="w-full px-2">
                  <PseudoPlate
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="TON PSEUDO"
                    maxLength={GAME_CONFIG.MAX_NAME_LENGTH}
                    onSubmit={undefined}
                  />
                </div>
                {!lobbyCode ? (
                  <div className="text-center space-y-2">
                    <Button
                      text="Créer un salon"
                      variant="primary"
                      size="md"
                      onClick={createLobby}
                    />
                  </div>
                ) : lobbyExists === null ? (
                  <div className="text-center">
                    <span className="text-sm text-gray-500">Vérification du salon...</span>
                  </div>
                ) : (
                  <div>
                    <Button text="Rejoindre" variant="warning" size="md" onClick={joinLobby} />
                  </div>
                )}
              </Frame>
            </div>

            {/* Bouton Comment jouer - mobile uniquement (PC: carousel inline à droite) */}
            <div className="md:hidden mt-4 flex justify-center">
              <HowToPlayButton onClick={() => setIsInfoOpen(true)} />
            </div>
          </div>

          {/* Bloc explications - desktop only (même carousel que la modale mobile) */}
          <div className="hidden md:block md:col-span-6">
            <Frame textAlign="left">
              <div className="w-full border-b-2 border-dashed border-gray-300 pb-3 mb-4 flex items-center gap-2">
                <Icon icon="fluent-emoji-flat:direct-hit" width={26} height={26} aria-hidden />
                <h2 className="marker-highlight font-accent text-display-lg text-gray-900 m-0">
                  Comment jouer ?
                </h2>
              </div>
              <HowToPlayCarousel />
            </Frame>
          </div>

          {/* Spacer droit - desktop only */}
          <div className="hidden md:block md:col-span-1" />
        </div>
      </div>

      {/* Footer - shrink-0 pour rester collé en bas, safe-area déjà gérée dans le composant */}
      <div className="shrink-0">
        <Footer />
      </div>

      {import.meta.env.DEV && window.self === window.top && (
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg bg-black/80 text-white text-xs font-display border-2 border-white/20 hover:bg-black hover:scale-105 transition-all stack-shadow-sm"
          title="Mode debug : ouvrir le Studio multi-écrans"
        >
          🎬 Studio
        </button>
      )}
    </div>
  );
};

export default Home;
