import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { RoundPhase } from '@onskone/shared';

interface TimerProps {
  duration: number; // Durée en secondes (fallback si pas de signal serveur)
  onExpire?: () => void;
  phase?: RoundPhase; // Phase pour filtrer les événements timerStarted
  lobbyCode?: string; // Code du lobby pour demander l'état du timer (utile pour Edge)
}

const Timer = ({ duration, onExpire, phase, lobbyCode }: TimerProps) => {
  const { timeLeft } = useSyncedTimer(duration, { onExpire, phase, lobbyCode });

  const progress = (timeLeft / duration) * 100;
  const isUrgent = timeLeft <= 10;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-600">Temps restant</span>
        <span className={`text-2xl font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
          {timeLeft}s
        </span>
      </div>
      <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-red-500' : 'bg-green-500'
            }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default Timer;
