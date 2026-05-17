import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import socket from '../utils/socket';
import HourglassTimer from './HourglassTimer';
import Avatar from './Avatar';
import Button from './Button';
import QuestionCard from './QuestionCard';
import QuestionByline from './QuestionByline';
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
  const [open, setOpen] = useState(false);
  const selectedIdRef = useRef(effectiveSelectedId);
  const submittedRef = useRef(submitted);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const expireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { selectedIdRef.current = effectiveSelectedId; }, [effectiveSelectedId]);
  useEffect(() => { submittedRef.current = submitted; }, [submitted]);

  useStartTimerDelayed(isLeader, lobbyCode, GAME_CONFIG.TIMERS.SUBSTITUTE_SELECTION);

  useEffect(() => {
    return () => {
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const submitSelection = (id: string) => {
    if (!id || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    setOpen(false);
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

  const selectedPlayer = candidates.find(p => p.id === effectiveSelectedId);

  return (
    <div className="flex flex-col items-center h-full p-3 md:p-6 gap-4 max-w-md mx-auto w-full">
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

          <div ref={dropdownRef} className="relative w-full" style={{ zIndex: 30 }}>
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              disabled={submitted || candidates.length === 0}
              aria-haspopup="listbox"
              aria-expanded={open}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-[12px] border-[2.5px] border-black bg-cream-player texture-paper stack-shadow-sm transition-transform duration-150 active:scale-[0.99] cursor-pointer ${submitted ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                {selectedPlayer ? (
                  <>
                    <Avatar avatarId={selectedPlayer.avatarId} name={selectedPlayer.name} size="sm" />
                    <span className="font-display font-semibold text-black truncate">{selectedPlayer.name}</span>
                  </>
                ) : (
                  <span className="text-gray-500 italic">Aucun joueur disponible</span>
                )}
              </span>
              <Icon
                icon="lucide:chevron-down"
                width={22}
                height={22}
                className={`shrink-0 text-black transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>

            {candidates.length > 0 && (
              <ul
                role="listbox"
                {...(!open ? { inert: '' } : {})}
                className={`list-none p-1 rounded-[12px] border-[2.5px] border-black bg-cream-player texture-paper stack-shadow overflow-y-auto origin-top transition-all duration-200 ease-out ${open ? 'max-h-[30vh] md:max-h-[45vh] opacity-100 scale-y-100 translate-y-0 pointer-events-auto' : 'max-h-0 opacity-0 scale-y-95 -translate-y-1 pointer-events-none'}`}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  margin: 0,
                  zIndex: 40,
                }}
              >
                {candidates.map(player => {
                  const isSelected = player.id === effectiveSelectedId;
                  return (
                    <li key={player.id} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => { setPickedId(player.id); setOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] transition-colors duration-150 cursor-pointer ${isSelected ? 'bg-[#FFE680]' : 'hover:bg-black/5'
                          }`}
                      >
                        <Avatar avatarId={player.avatarId} name={player.name} size="sm" />
                        <span className="font-display font-semibold text-black truncate flex-1 text-left">
                          {player.name}
                        </span>
                        {isSelected && (
                          <Icon icon="lucide:check" width={18} height={18} className="text-black shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

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
