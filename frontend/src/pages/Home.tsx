import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import PseudoPlate from '../components/PseudoPlate';
import Footer from '../components/Footer';
import AvatarSelector from '../components/AvatarSelector';
import InfoModal from '../components/InfoModal';
import { useToast } from '../components/Toast';
import { BsFillCaretLeftFill } from "react-icons/bs";
import { Icon } from '@iconify/react';
import { useSocketEvent, useQueryParams } from '../hooks';
import { GAME_CONFIG, AVATARS } from '../constants/game';

const HOW_TO_PLAY_STEPS = [
  {
    n: '1',
    icon: 'fluent-emoji-flat:crown',
    text: (<>Un <b>pilier</b> est designé aléatoirement et choisit une question parmi trois cartes.</>),
    rot: '-1deg',
  },
  {
    n: '2',
    icon: 'fluent-emoji-flat:memo',
    text: (<>Tout le monde répond <b>anonymement</b> et le pilier devine qui a écrit quelle réponse.</>),
    rot: '0.8deg',
  },
  {
    n: '3',
    icon: 'fluent-emoji-flat:party-popper',
    text: (<>On révèle les prénoms, le pilier marque des points pour l'équipe et on passe au suivant.</>),
    rot: '-0.6deg',
  },
] as const;

const HowToPlaySteps = ({ size = 'md' }: { size?: 'md' | 'lg' }) => {
  const isLg = size === 'lg';
  return (
    <div className="w-full">
      <div className="space-y-3 w-full">
        {HOW_TO_PLAY_STEPS.map(({ n, icon, text, rot }, i) => (
          <div
            key={n}
            className="animate-step-drop"
            style={{ animationDelay: `${300 + i * 520}ms` }}
          >
            <div
              className="flex items-center gap-3 bg-cream-player border-[2.5px] border-black rounded-xl p-3 stack-shadow-sm texture-paper hover:-translate-y-0.5 transition-transform"
              style={{ transform: `rotate(${rot})` }}
            >
              <div className={`flex-shrink-0 ${isLg ? 'w-11 h-11 text-lg' : 'w-10 h-10 text-base'} rounded-full flex items-center justify-center text-gray-800 bg-[#f3ece2] border-[2.5px] border-black font-display`}>
                {n}
              </div>
              <Icon icon={icon} className="flex-shrink-0" width={isLg ? 30 : 26} height={isLg ? 30 : 26} aria-hidden />
              <p className={`${isLg ? 'text-base' : 'text-sm'} m-0 leading-snug`}>{text}</p>
            </div>
          </div>
        ))}
      </div>
      <p
        className={`text-center ${isLg ? 'text-xl mt-4' : 'text-lg pt-3'} font-display text-primary animate-step-drop`}
        style={{ animationDelay: `${300 + HOW_TO_PLAY_STEPS.length * 520}ms` }}
      >
        Alors, on se connaît ?
      </p>
    </div>
  );
};

const Home = () => {
  const [playerName, setPlayerName] = useState<string>('');
  const [avatarId, setAvatarId] = useState<number>(Math.floor(Math.random() * AVATARS.length));
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [hostName, setHostName] = useState<string | null>(null);
  const [lobbyExists, setLobbyExists] = useState<boolean | null>(null);
  const [lobbyExpired, setLobbyExpired] = useState(false);
  const queryParams = useQueryParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const lobbyCode = queryParams.get('lobbyCode');

  // Fetch lobby info when there's a lobby code in URL
  useEffect(() => {
    if (lobbyCode) {
      socket.emit('getLobbyInfo', { lobbyCode });
    }
  }, [lobbyCode]);

  const createLobby = useCallback(() => {
    if (!playerName.trim()) {
      showToast('Entre ton pseudo avant de créer un salon.', 'warning');
      return;
    }
    socket.emit('createLobby', { playerName, avatarId });
  }, [playerName, avatarId, showToast]);

  const joinLobby = useCallback(() => {
    if (!playerName.trim()) {
      showToast('Entre ton pseudo avant de rejoindre un salon.', 'warning');
      return;
    }
    if (!lobbyCode) {
      showToast('Code de salon invalide.', 'error');
      return;
    }
    socket.emit('checkPlayerName', { lobbyCode, playerName });
  }, [lobbyCode, playerName, showToast]);

  const handleLobbyCreated = useCallback((data: { lobbyCode: string }) => {
    navigate(`/lobby/${data.lobbyCode}?playerName=${encodeURIComponent(playerName)}&avatarId=${avatarId}`);
  }, [navigate, playerName, avatarId]);

  const handlePlayerNameExists = useCallback((data: { playerName: string }) => {
    showToast(`Le pseudo "${data.playerName}" est déjà pris dans ce salon.`, 'warning');
  }, [showToast]);

  const handlePlayerNameValid = useCallback(() => {
    navigate(`/lobby/${lobbyCode}?playerName=${encodeURIComponent(playerName)}&avatarId=${avatarId}`);
  }, [navigate, lobbyCode, playerName, avatarId]);

  const handleError = useCallback((data: { message: string }) => {
    console.error('Erreur:', data.message);
    showToast(data.message, 'error');
  }, [showToast]);

  const handleLobbyInfo = useCallback((data: { exists: boolean; hostName?: string | null }) => {
    setLobbyExists(data.exists);
    if (data.exists && data.hostName) {
      setHostName(data.hostName);
    } else if (!data.exists) {
      setLobbyExpired(true);
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
        <HowToPlaySteps />
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
          <div className="md:col-span-4">
            <Frame>
              {lobbyCode && (
                <div className="flex items-center cursor-pointer self-start" onClick={() => navigate('/')}>
                  <span className="flex items-center mr-1.5">
                    <BsFillCaretLeftFill size={15} />
                  </span>
                  <span className="text-sm md:text-base">Quitter</span>
                </div>
              )}
              {lobbyCode && lobbyExists ? (
                <h3 className="text-lg md:text-xl">Vous êtes invité à rejoindre le salon de <b>{hostName || 'un ami'}</b></h3>
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
                  onSubmit={lobbyCode ? (lobbyExists ? joinLobby : undefined) : createLobby}
                />
              </div>
              {!lobbyCode ? (
                <div className="text-center space-y-2">
                  {lobbyExpired && (
                    <p className="text-sm text-red-600">Ce salon n'existe plus ou a expiré.</p>
                  )}
                  <Button
                    text={lobbyExpired ? "Créer un nouveau salon" : "Créer un salon"}
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

            {/* Bouton Comment jouer - mobile uniquement */}
            <div className="md:hidden mt-4 text-center">
              <button
                onClick={() => setIsInfoOpen(true)}
                className="text-white text-sm underline underline-offset-2 hover:text-white/80 transition-colors cursor-pointer"
              >
                Comment jouer ?
              </button>
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
    </div>
  );
};

export default Home;
