import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import socket from '../utils/socket';
import Logo from '../components/Logo';
import Frame from '../components/Frame';
import Button from '../components/Button';
import InputText from '../components/InputText';
import Footer from '../components/Footer';

const Home = () => {
  const [playerName, setPlayerName] = useState<string>(() => {
    const randomName = `Joueur${Math.floor(Math.random() * 1000)}`; // TODO ONLY FOR DEVMODE !
    return randomName;
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const lobbyCode = searchParams.get('lobbyCode');

  const createLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de créer un salon.');
      return;
    }
    socket.emit('createLobby', { playerName });
  };

  const joinLobby = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer un nom avant de rejoindre un salon.');
      return;
    }
    socket.emit('checkPlayerName', { lobbyCode, playerName });
  };

  useEffect(() => {
    socket.on('lobbyCreated', (data) => {
      console.log(`Salon créé avec le code : ${data.lobbyCode}`);
      console.log(`Joueur ajouté au salon : ${data.playerName}`);
      navigate(`/lobby/${data.lobbyCode}?playerName=${playerName}`);
    });

    socket.on('playerNameExists', (data) => {
      console.log(`Le nom "${data.playerName}" est déjà utilisé dans le salon. Veuillez choisir un autre nom.`);
      alert(`Le nom "${data.playerName}" est déjà utilisé dans le salon. Veuillez choisir un autre nom.`);
    });

    socket.on('playerNameValid', () => {
      console.log(`Le nom "${playerName}" est valide.`);
      navigate(`/lobby/${lobbyCode}?playerName=${playerName}`);
    });

    socket.on('error', (data) => {
      console.error('Erreur:', data.message);
      alert(`Erreur: ${data.message}`);
    });

    return () => {
      socket.off('lobbyCreated');
      socket.off('playerNameExists');
      socket.off('playerNameValid');
      socket.off('error');
    };
  }, [navigate, playerName, lobbyCode]);

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
              maxlength="20"
            />
          </div>
          {!lobbyCode ? (
            <div>
              <Button text="Créer un salon" backgroundColor="#1AAFDA" onClick={createLobby} />
            </div>
          ) : (
            <div>
              <small style={{ display: 'block', marginBottom: '7px' }}>Vous êtes invité à rejoindre le salon <b>{lobbyCode}</b></small>
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
