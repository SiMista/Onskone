import React, { useEffect, useState } from 'react';

interface TimerProps {
  duration: number; // Durée en secondes
  onExpire?: () => void;
}

const Timer: React.FC<TimerProps> = ({ duration, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onExpire]);

  const progress = (timeLeft / duration) * 100;
  const isUrgent = timeLeft <= 10;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-2xl font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white'}`}>
          {timeLeft}s
        </span>
        <span className="text-sm text-white/70">Temps restant</span>
      </div>
      <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            isUrgent ? 'bg-red-500' : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default Timer;
