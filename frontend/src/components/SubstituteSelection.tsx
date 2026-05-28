import { useEffect, useMemo, useRef, useState } from 'react';
import socket from '../utils/socket';
import HourglassTimer from './HourglassTimer';
import Avatar from './Avatar';
import Button from './Button';
import QuestionCard from './QuestionCard';
import QuestionByline from './QuestionByline';
import Dropdown from './Dropdown';
import { GAME_CONFIG } from '../constants/game';
import { IPlayer, RoundPhase, GameCard } from '@onskone/shared';
import { useStartTimerDelayed } from '../hooks';
import { getQuestionSubtitle } from '../utils/questionHelpers';

interface SubstituteSelectionProps {
  lobbyCode: string;
  isLeader: boolean;
  leaderId: string;
  players: IPlayer[];
  question: string;
  card?: GameCard;
}

const SubstituteSelection: React.FC<SubstituteSelectionProps> = ({
  lobbyCode,
  isLeader,
  leaderId,
  players,
  question,
  card,
}) => {
  const leader = players.find(p => p.id === leaderId);
  // Mémoïser candidates pour éviter qu'un nouveau tableau à chaque render
  // ne déclenche en boucle l'effet qui dépend de cette valeur.
  const candidates = useMemo(
    () => players.filter(p => p.id !== leaderId && p.isActive),
    [players, leaderId]
  );

  // Effective selection : valeur calculée pendant le render plutôt que via un effet
  // qui synchronise du state dérivé.
  const [pickedId, setPickedId] = useState<string>('');
  const effectiveSelectedId = candidates.find(c => c.id === pickedId)?.id ?? candidates[0]?.id ?? '';

  const [submitted, setSubmitted] = useState(false);
  const selectedIdRef = useRef(effectiveSelectedId);
  const submittedRef = useRef(submitted);
  const expireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { selectedIdRef.current = effectiveSelectedId; }, [effectiveSelectedId]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  useStartTimerDelayed(isLeader, lobbyCode, GAME_CONFIG.TIMERS.SUBSTITUTE_SELECTION);

  useEffect(() => {
    return () => {
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
    };
  }, []);

  const submitSelection = (id: string) => {
    if (!id || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    socket.emit('selectSubstitute', { lobbyCode, substitutePlayerId: id });
  };

  const handleValidate = () => {
    if (!isLeader) return;
    submitSelection(effectiveSelectedId);
  };

  const handleTimerExpire = () => {
    if (!isLeader) return;
    if (!submittedRef.current && selectedIdRef.current) {
      submitSelection(selectedIdRef.current);
      return;
    }
    if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
    expireTimeoutRef.current = setTimeout(() => socket.emit('timerExpired', { lobbyCode }), 300);
  };

  const subtitle = isLeader ? getQuestionSubtitle(RoundPhase.SUBSTITUTE_SELECTION, isLeader) : '';
  const subtitleBadge = undefined;

  const dropdownOptions = candidates.map(p => ({
    value: p.id,
    label: p.name,
    prefix: <Avatar avatarId={p.avatarId} name={p.name} size="sm" />,
  }));

  return (
    <div className="flex flex-col items-center h-full p-3 md:p-6 gap-4 max-w-md mx-auto w-full overflow-hidden">
      <HourglassTimer
        duration={GAME_CONFIG.TIMERS.SUBSTITUTE_SELECTION}
        onExpire={handleTimerExpire}
        phase={RoundPhase.SUBSTITUTE_SELECTION}
        lobbyCode={lobbyCode}
        hidden
      />

      {!isLeader && <QuestionByline player={leader} />}

      <QuestionCard question={question} card={card} subtitle={subtitle} subtitleBadge={subtitleBadge} variant="compact" />

      {isLeader ? (
        <>
          <p className="text-center text-sm md:text-base text-gray-700 italic px-2">
            Le joueur que tu choisis devra deviner la réponse que tu aurais donnée.
          </p>

          <Dropdown
            value={effectiveSelectedId}
            onChange={setPickedId}
            options={dropdownOptions}
            placeholder="Aucun joueur disponible"
            disabled={submitted}
          />

          <Button
            variant="success"
            size="lg"
            onClick={handleValidate}
            disabled={submitted || !effectiveSelectedId}
          >
            Valider
          </Button>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-center text-base md:text-lg text-gray-700 italic">
            choisit le joueur qui répondra pour lui...
          </p>
        </div>
      )}
    </div>
  );
};

export default SubstituteSelection;
