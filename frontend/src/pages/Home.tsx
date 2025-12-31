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
import { useSocketEvent, useQueryParams } from '../hooks';
import { GAME_CONFIG, AVATARS } from '../constants/game';

const Home = () => {
  const [playerName, setPlayerName] = useState<string>('');
  const [avatarId, setAvatarId] = useState<number>(Math.floor(Math.random() * AVATARS.length));
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [hostName, setHostName] = useState<string | null>(null);
  const [lobbyExists, setLobbyExists] = useState<boolean | null>(null);
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
    }
  }, []);

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
        <div className="space-y-4">
          <p>
            <span className="font-bold">1.</span> Chaque manche, un <b>pilier</b> est choisi au hasard et sélectionne une question parmi trois propositions.
          </p>
          <p>
            <span className="font-bold">2.</span> Les joueurs répondent <b>anonymement</b>, et le pilier tente de deviner qui a écrit quoi.
          </p>
          <p>
            <span className="font-bold">3.</span> À la fin, les prénoms sont révélés et le pilier marque des points selon ses bonnes réponses.
          </p>
          <p className="text-center text-lg font-bold text-primary mt-6">
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
              <h3 className="text-lg md:text-xl font-bold">JOUE MAINTENANT !</h3>
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
                <div>
                  <Button text="Créer un salon" variant="primary" size="md" onClick={createLobby} />
                </div>
              ) : lobbyExists === null ? (
                <div className="text-center">
                  <span className="text-sm text-gray-500">Vérification du salon...</span>
                </div>
              ) : lobbyExists === false ? (
                <div className="text-center space-y-2">
                  <p className="text-sm text-red-600">Ce salon n'existe plus ou a expiré.</p>
                  <Button text="Créer un nouveau salon" variant="primary" size="md" onClick={createLobby} />
                </div>
              ) : (
                <div>
                  <small className="block mb-2 text-sm">
                    Vous êtes invité à rejoindre le salon de <b>{hostName || 'un ami'}</b>
                  </small>
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
              <div className="w-full border-b border-gray-200 pb-3 mb-2">
                <h2 className='text-xl font-bold text-gray-800 m-0'>Comment jouer ?</h2>
              </div>
              <div className="space-y-4">
                <p>
                  <span className="font-bold">1.</span> Un <b>pilier</b> est choisi au hasard et sélectionne une question parmi trois propositions.
                </p>
                <p>
                  <span className="font-bold">2.</span> Les joueurs répondent <b>anonymement</b>, et le pilier tente de deviner qui a écrit quoi.
                </p>
                <p>
                  <span className="font-bold">3.</span> À la fin, les prénoms sont révélés et le pilier marque des points selon ses bonnes réponses.
                </p>
              </div>
              <p className="text-center text-lg font-bold text-primary mt-6">
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
