import { useEffect, useMemo, useState } from 'react';
import { DRAWING_PORTRAIT_ID, type GameMode } from '@onskone/shared';
import GameFrame, { PHASE_AREA_CLASS } from '../../components/GameFrame';
import RevealPhase from '../../components/RevealPhase';
import QuestionSelection from '../../components/QuestionSelection';
import SettingsButton from '../../components/SettingsButton';
import { dispatchPreviewServerEvent } from '../../utils/socket';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { getScenario, type PreviewServerEvent, type RevealScreenState } from './screens/scenarios';

// =====================================================================
// Un téléphone de l'aperçu d'écrans du Studio (DEV, route /studio/screen).
//
// URL : ?scenario=<id>&viewer=<id du joueur>&mode=local|remote. Rend le VRAI écran
// de jeu (GameFrame + phase) avec l'état de table fourni par le Studio parent, sans
// serveur : la socket de cette page ne se connecte pas et ses envois remontent au
// Studio (cf. utils/socket.ts), qui joue le faux serveur et renvoie à chaque
// téléphone le nouvel état + les évènements à rejouer.
// =====================================================================

/** Numéro de manche affiché dans l’en-tête de l’aperçu. */
const PREVIEW_ROUND = 1;

const ScreenPreview = () => {
  useDocumentMeta({ title: 'Onskoné - Aperçu', robots: 'noindex, nofollow' });

  const { scenario, viewer, mode } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const s = getScenario(params.get('scenario'));
    return {
      scenario: s,
      viewer: params.get('viewer') ?? s.leader.id,
      mode: (params.get('mode') === 'remote' ? 'remote' : 'local') as GameMode,
    };
  }, []);
  const [table, setTable] = useState<RevealScreenState>(scenario.initial);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const data = e.data as { type?: string; state?: RevealScreenState; events?: PreviewServerEvent[] };
      if (data?.type !== 'studio:screenUpdate' || !data.state) return;
      // État d'abord, évènements ensuite (comme le vrai serveur : similarityDetected
      // avant answerRevealed) ; React regroupe les deux mises à jour en un rendu.
      setTable(data.state);
      data.events?.forEach((ev) => dispatchPreviewServerEvent(ev.event, ev.data));
    };
    window.addEventListener('message', onMessage);
    // Le Studio renvoie l'état courant de la table (utile après un rechargement du téléphone).
    window.parent?.postMessage({ type: 'studio:screenReady' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const isLeader = viewer === scenario.leader.id;

  return (
    <div className="relative h-dvh w-full flex flex-col overflow-hidden">
      <GameFrame
        settings={<SettingsButton contentLocale="fr" lobbyCode="APERCU" />}
        roundNumber={PREVIEW_ROUND}
        totalRounds={scenario.players.length + 1}
        leaderName={scenario.leader.name}
      >
        <div className={PHASE_AREA_CLASS}>
          {scenario.screen === 'whiteboard' ? (
            <QuestionSelection
              lobbyCode="APERCU"
              isLeader={false}
              leader={scenario.leader}
              players={[scenario.leader, ...scenario.players]}
              // Le portrait : l'idée la plus longue (pseudo compris), c'est elle qu'on veut voir tenir.
              drawingIdea={{ id: DRAWING_PORTRAIT_ID, playerId: scenario.players[0]?.id ?? scenario.leader.id }}
              currentPlayerId={viewer}
              roundNumber={PREVIEW_ROUND}
              gameSpeed="normal"
            />
          ) : (
            <RevealPhase
              lobbyCode="APERCU"
              isLeader={isLeader}
              leader={scenario.leader}
              currentPlayerId={viewer}
              isGameOver={false}
              results={table.results}
              revealOrder={table.revealOrder}
              serverRevealedIndices={table.revealed}
              pendingSimilarityIndex={table.pending}
              similarityCorrections={table.corrections}
              gameMode={mode}
            />
          )}
        </div>
      </GameFrame>
    </div>
  );
};

export default ScreenPreview;
