import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import InputText from '../components/InputText';
import Footer from '../components/Footer';
import AvatarSelector from '../components/AvatarSelector';
import InfoModal from '../components/InfoModal';
import { BsFillCaretLeftFill } from "react-icons/bs";
import { useSocketEvent, useQueryParams } from '../hooks';
import { GAME_CONFIG, AVATARS } from '../constants/game';

const Home = () => {
  const [playerName, setPlayerName] = useState<string>('');
  const [avatarId, setAvatarId] = useState<number>(Math.floor(Math.random() * AVATARS.length));
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [hostName, setHostName] = useState<string | null>(null);
  const [lobbyExists, setLobbyExists] = useState<boolean | null>(null);
  const [lobbyExpired, setLobbyExpired] = useState(false);
  const queryParams = useQueryParams();
  const navigate = useNavigate();

  const lobbyCode = queryParams.get('lobbyCode');

  // Fetch lobby info when there's a lobby code in URL
  useEffect(() => {
    if (lobbyCode) {
      socket.emit('getLobbyInfo', { lobbyCode });
    }
  }, [lobbyCode]);

  const createLobby = useCallback(() => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de créer un salon.');
      return;
    }
    socket.emit('createLobby', { playerName, avatarId });
  }, [playerName, avatarId]);

  const joinLobby = useCallback(() => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de rejoindre un salon.');
      return;
    }
    if (!lobbyCode) {
      alert('Code de salon invalide.');
      return;
    }
    socket.emit('checkPlayerName', { lobbyCode, playerName });
  }, [lobbyCode, playerName]);

  const handleLobbyCreated = useCallback((data: { lobbyCode: string }) => {
    navigate(`/lobby/${data.lobbyCode}?playerName=${encodeURIComponent(playerName)}&avatarId=${avatarId}`);
  }, [navigate, playerName, avatarId]);

  const handlePlayerNameExists = useCallback((data: { playerName: string }) => {
    alert(`Le nom "${data.playerName}" est déjà utilisé dans le salon. Veuillez choisir un autre nom.`);
  }, []);

  const handlePlayerNameValid = useCallback(() => {
    navigate(`/lobby/${lobbyCode}?playerName=${encodeURIComponent(playerName)}&avatarId=${avatarId}`);
  }, [navigate, lobbyCode, playerName, avatarId]);

  const handleError = useCallback((data: { message: string }) => {
    console.error('Erreur:', data.message);
    alert(`Erreur: ${data.message}`);
  }, []);

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
        <div className="space-y-3">
          {[
            { n: '1', emoji: '👑', text: (<>Un <b>pilier</b> est tiré au sort et pioche une question parmi trois propositions.</>), color: '#1AAFDA' },
            { n: '2', emoji: '✍️', text: (<>Tout le monde répond <b>anonymement</b>, le pilier tente de deviner qui a écrit quoi.</>), color: '#FFC700' },
            { n: '3', emoji: '🎉', text: (<>On révèle les prénoms, le pilier marque des points et on passe au suivant !</>), color: '#30c94d' },
          ].map((step) => (
            <div
              key={step.n}
              className="flex items-center gap-3 bg-[#f9f4ee] border-2 border-black rounded-xl p-3 shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]"
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-black border-2 border-black text-lg"
                style={{ backgroundColor: step.color }}
              >
                {step.n}
              </div>
              <span className="text-2xl" aria-hidden>{step.emoji}</span>
              <p className="text-sm m-0">{step.text}</p>
            </div>
          ))}
          <p className="text-center text-lg font-display font-bold text-primary pt-2">
            Alors, on se connaît ?
          </p>
        </div>
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
              <div>
                <InputText
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Ton pseudo"
                  borderColor="#1AAFDA"
                  maxLength={GAME_CONFIG.MAX_NAME_LENGTH}
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
              <div className="w-full border-b-2 border-dashed border-gray-300 pb-3 mb-3 flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <h2 className='text-2xl font-display font-bold text-gray-800 m-0'>Comment jouer ?</h2>
              </div>
              <div className="space-y-3 w-full">
                {[
                  { n: '1', emoji: '👑', text: (<>Un <b>pilier</b> est tiré au sort et pioche une question parmi trois propositions.</>), color: '#1AAFDA', rot: '-1deg' },
                  { n: '2', emoji: '✍️', text: (<>Tout le monde répond <b>anonymement</b>, et le pilier devine qui a écrit quoi.</>), color: '#FFC700', rot: '0.8deg' },
                  { n: '3', emoji: '🎉', text: (<>On révèle les prénoms, le pilier marque des points et on passe au suivant.</>), color: '#30c94d', rot: '-0.6deg' },
                ].map((step) => (
                  <div
                    key={step.n}
                    className="flex items-center gap-3 bg-[#f9f4ee] border-2 border-black rounded-xl p-3 shadow-[3px_3px_0_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:shadow-[4px_5px_0_0_rgba(0,0,0,0.2)] transition-all"
                    style={{ transform: `rotate(${step.rot})` }}
                  >
                    <div
                      className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-black border-2 border-black text-xl"
                      style={{ backgroundColor: step.color }}
                    >
                      {step.n}
                    </div>
                    <span className="text-3xl" aria-hidden>{step.emoji}</span>
                    <p className="text-base m-0">{step.text}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-xl font-display font-bold text-primary mt-4">
                Alors, on se connaît ?
              </p>
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
