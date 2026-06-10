import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { useRafProgress } from '../hooks/useRafProgress';
import { RoundPhase } from '@onskone/shared';

interface TimerProps {
  duration: number; // Durée en secondes (fallback si pas de signal serveur)
  onExpire?: () => void;
  phase?: RoundPhase; // Phase pour filtrer les événements timerStarted
  lobbyCode?: string; // Code du lobby pour demander l'état du timer (utile pour Edge)
  hidden?: boolean; // Si true, ne rend rien (utile pour conserver uniquement la logique d'expiration)
}

const Timer = ({ duration, onExpire, phase, lobbyCode, hidden }: TimerProps) => {
  const { timeLeft, endTime } = useSyncedTimer(duration, { onExpire, phase, lobbyCode });
  const { progress } = useRafProgress({ duration, endTime, timeLeft });

  const isCritical = progress <= 10;
  const isWarning = progress <= 30 && !isCritical;

  const fillColor = isCritical ? '#ff5a4e' : isWarning ? '#ffa630' : '#51d88a';

  if (hidden) return null;

  return (
    <div className="w-3/4 mx-auto">
      <div
        className={`relative w-full h-1.5 md:h-2 rounded-full bg-black/15 overflow-hidden ${isCritical ? 'animate-timer-wobble' : ''}`}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${progress}%`, backgroundColor: fillColor, transition: 'background-color 0.4s ease' }}
        />
      </div>
    </div>
  );
};

export default Timer;
