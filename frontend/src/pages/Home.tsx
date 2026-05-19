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
import HowToPlaySteps from '../components/HowToPlaySteps';
import HowToPlayCarousel from '../components/HowToPlayCarousel';
import HowToPlayButton from '../components/HowToPlayButton';
import { useToast } from '../components/Toast';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { useSocketEvent, useQueryParams } from '../hooks';
import { GAME_CONFIG, AVATARS } from '../constants/game';
import { getStats, rememberIdentity, ACHIEVEMENTS } from '../utils/playerStats';

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
    <div className="min-h-screen flex flex-col">
      {/* Modal d'information */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title="Comment jouer ?"
      >
        <HowToPlayCarousel />
      </InfoModal>

      <InfoModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        title="Mes succès"
      >
        {(() => {
          const stats = getStats();
          const unlocked = new Set(stats.unlockedAchievements);
          return (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-center mb-1">
                <div className="bg-cream-player border-2 border-black rounded-xl p-2 stack-shadow-sm">
                  <div className="text-xl font-display font-bold tabular-nums">{stats.gamesPlayed}</div>
                  <div className="text-[10px] uppercase tracking-wider font-display text-gray-600">Parties</div>
                </div>
                <div className="bg-cream-player border-2 border-black rounded-xl p-2 stack-shadow-sm">
                  <div className="text-xl font-display font-bold tabular-nums">{stats.bestScore}</div>
                  <div className="text-[10px] uppercase tracking-wider font-display text-gray-600">Meilleur score</div>
                </div>
                <div className="bg-cream-player border-2 border-black rounded-xl p-2 stack-shadow-sm">
                  <div className="text-xl font-display font-bold tabular-nums">{stats.correctGuessesAsLeader}</div>
                  <div className="text-[10px] uppercase tracking-wider font-display text-gray-600">Devinettes</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = unlocked.has(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 border-black transition-all ${isUnlocked ? 'stack-shadow-sm' : 'bg-gray-100 opacity-60'}`}
                      style={isUnlocked ? {
                        background: 'linear-gradient(135deg, #FFE066 0%, #FFB347 100%)',
                      } : undefined}
                    >
                      <div
                        className="flex-shrink-0"
                        style={{
                          filter:
                            'drop-shadow(1px 0 0 #000) drop-shadow(-1px 0 0 #000) drop-shadow(0 1px 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(1px 2px 0 rgba(0,0,0,0.35))',
                        }}
                      >
                        <Icon icon={ach.icon} width={40} height={40} aria-hidden />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-display font-bold text-sm text-gray-900 leading-tight">
                          {ach.title}
                        </div>
                        <div className={`text-xs leading-snug ${isUnlocked ? 'text-gray-800' : 'text-gray-600'}`}>
                          {ach.description}
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
      <div className="flex-1 w-full max-w-screen-xl mx-auto px-4 py-4 md:py-4 flex flex-col justify-center md:justify-start">
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
                onClick={() => setIsStatsOpen(true)}
                aria-label="Voir mes succès"
                className="absolute -top-6 -right-4 z-10 rotate-12 hover:scale-110 hover:rotate-6 active:scale-95 transition-transform cursor-pointer"
                style={{ filter: 'drop-shadow(2px 3px 0 rgba(0,0,0,0.35))' }}
              >
                <Icon
                  icon="fluent-emoji-flat:trophy"
                  width={56}
                  height={56}
                  aria-hidden
                />
              </button>
              <Frame>
              {lobbyCode && lobbyExists ? (
                <h3 className="text-sm md:text-base">Vous êtes invité à rejoindre le salon de <b>{hostName || 'un ami'}</b></h3>
              ) : (
                <h3 className="text-lg md:text-xl font-bold">JOUE MAINTENANT !</h3>
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

            {/* Bouton Comment jouer - mobile uniquement */}
            <div className="md:hidden mt-4 flex justify-center">
              <HowToPlayButton onClick={() => setIsInfoOpen(true)} />
            </div>
          </div>

          {/* Bloc explications - desktop only */}
          <div className="hidden md:block md:col-span-6">
            <Frame textAlign="left">
              <div className="w-full border-b-2 border-dashed border-gray-300 pb-3 mb-4 flex items-center gap-2">
                <Icon icon="fluent-emoji-flat:direct-hit" width={26} height={26} aria-hidden />
                <h2 className='text-2xl font-display text-gray-800 m-0'>Comment jouer ?</h2>
              </div>
              <HowToPlaySteps size="lg" />
            </Frame>
          </div>

          {/* Spacer droit - desktop only */}
          <div className="hidden md:block md:col-span-1" />
        </div>
      </div>

      {/* Footer */}
      <Footer />

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
