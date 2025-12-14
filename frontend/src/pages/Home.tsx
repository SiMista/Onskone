import { useState, useCallback } from 'react';
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
  const [playerName, setPlayerName] = useState<string>(`Joueur${Math.floor(Math.random() * 1000)}`);
  const [avatarId, setAvatarId] = useState<number>(Math.floor(Math.random() * AVATARS.length));
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const queryParams = useQueryParams();
  const navigate = useNavigate();

  const lobbyCode = queryParams.get('lobbyCode');

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

  useSocketEvent('lobbyCreated', handleLobbyCreated, [handleLobbyCreated]);
  useSocketEvent('playerNameExists', handlePlayerNameExists, [handlePlayerNameExists]);
  useSocketEvent('playerNameValid', handlePlayerNameValid, [handlePlayerNameValid]);
  useSocketEvent('error', handleError, [handleError]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Bouton info - visible uniquement sur mobile */}
      <button
        onClick={() => setIsInfoOpen(true)}
        className="md:hidden fixed top-4 right-4 z-40 w-10 h-10 rounded-full bg-transparent shadow-lg flex items-center justify-center text-primary text-white font-bold text-xl border-3 border-primary border-white hover:bg-primary transition-colors"
        aria-label="🎯 Comment jouer"
      >
        i
      </button>

      {/* Modal d'information */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        title="Comment jouer ?"
      >
        <div className="space-y-4">
          <p>
            <span className="font-bold">1.</span> Un <b>chef</b> est choisi au hasard et sélectionne une question parmi trois propositions.
          </p>
          <p>
            <span className="font-bold">2.</span> Les joueurs répondent <b>anonymement</b>, et le chef tente de deviner qui a écrit quoi.
          </p>
          <p>
            <span className="font-bold">3.</span> À la fin, les prénoms sont révélés et le chef marque des points selon ses bonnes réponses.
          </p>
          <p className="text-center text-lg font-bold text-primary mt-6">
            Alors, on se connaît ?
          </p>
        </div>
      </InfoModal>

      {/* Contenu principal */}
      <div className="flex-1 w-full max-w-screen-xl mx-auto px-4 py-4 md:py-8">
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
              <h3 className="text-lg md:text-xl">JOUE MAINTENANT !</h3>
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
              ) : (
                <div>
                  <small className="block mb-2 text-sm">
                    Vous êtes invité à rejoindre le salon <b>{lobbyCode}</b>
                  </small>
                  <Button text="Rejoindre" variant="warning" size="md" onClick={joinLobby} />
                </div>
              )}
            </Frame>
          </div>

          {/* Bloc explications - desktop only */}
          <div className="hidden md:block md:col-span-6">
            <Frame textAlign="left">
              <h2 className='text-lg font-bold mb-4'>🎯 Comment jouer ?</h2>
              <p>
                1. Un <b>chef</b> est choisi au hasard et sélectionne une question parmi trois propositions.
                <br /><br />
                2. Les joueurs répondent <b>anonymement</b>, et le chef tente de deviner qui a écrit quoi.
                <br /><br />
                3. À la fin, les prénoms sont révélés et le chef marque des points selon ses bonnes réponses.
              </p>
              <h3>Alors, on se connaît ?</h3>
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
