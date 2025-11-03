import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import InputText from '../components/InputText';
import Footer from '../components/Footer';
import { useSocketEvent, useQueryParams } from '../hooks';
import { GAME_CONFIG } from '../constants/game';

const Home = () => {
  const [playerName, setPlayerName] = useState<string>(() => {
    const randomName = `Joueur${Math.floor(Math.random() * 1000)}`; // TODO ONLY FOR DEVMODE !
    return randomName;
  });
  const queryParams = useQueryParams();
  const navigate = useNavigate();

  const lobbyCode = queryParams.get('lobbyCode');

  const createLobby = useCallback(() => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de créer un salon.');
      return;
    }
    socket.emit('createLobby', { playerName });
  }, [playerName]);

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
    navigate(`/lobby/${data.lobbyCode}?playerName=${playerName}`);
  }, [navigate, playerName]);

  const handlePlayerNameExists = useCallback((data: { playerName: string }) => {
    alert(`Le nom "${data.playerName}" est déjà utilisé dans le salon. Veuillez choisir un autre nom.`);
  }, []);

  const handlePlayerNameValid = useCallback(() => {
    navigate(`/lobby/${lobbyCode}?playerName=${playerName}`);
  }, [navigate, lobbyCode, playerName]);

  const handleError = useCallback((data: { message: string }) => {
    console.error('Erreur:', data.message);
    alert(`Erreur: ${data.message}`);
  }, []);

  useSocketEvent('lobbyCreated', handleLobbyCreated, [handleLobbyCreated]);
  useSocketEvent('playerNameExists', handlePlayerNameExists, [handlePlayerNameExists]);
  useSocketEvent('playerNameValid', handlePlayerNameValid, [handlePlayerNameValid]);
  useSocketEvent('error', handleError, [handleError]);

  return (
    <div className="container">
      <div className="col-12">
        <Logo size="large" />
      </div>
      <div className="col-1"></div>
      <div className="col-4" >
        <Frame>
          <h3>JOUE MAINTENANT !</h3>
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
              <Button text="Créer un salon" backgroundColor="#1AAFDA" onClick={createLobby} />
            </div>
          ) : (
            <div>
              <small className="block mb-[7px]">Vous êtes invité à rejoindre le salon <b>{lobbyCode}</b></small>
              <Button text="Rejoindre" backgroundColor="#FFC700" onClick={joinLobby} />
            </div>
          )}
        </Frame>
      </div>
      <div className="col-6">
        <Frame textAlign="left">
          <h2>🎯 Comment jouer ?</h2>
          <p>1. Un <b>chef</b> est choisi au hasard et sélectionne une question parmi trois propositions.<br /><br />
            2. Les joueurs répondent <b>anonymement</b>, et le chef tente de deviner qui a écrit quoi.<br /><br />
            3. À la fin, les prénoms sont révélés et le chef marque des points selon ses bonnes réponses.</p>
          <h3>Alors, on se connaît ?</h3>
        </Frame>
      </div>
      <div className="col-1"></div>
      <div className="col-12">
        <Footer />
      </div>
    </div>
  );
};

export default Home;
