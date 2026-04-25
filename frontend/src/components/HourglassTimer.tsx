import { useEffect, useRef, useState, useMemo } from 'react';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { RoundPhase } from '@onskone/shared';

interface HourglassTimerProps {
  duration: number;
  onExpire?: () => void;
  phase?: RoundPhase;
  lobbyCode?: string;
  size?: 'sm' | 'md' | 'lg';
  hidden?: boolean;
}

// Tailles responsive : {mobile} / {desktop md:} — en px pour le SVG et le texte
const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', { svg: string; text: string }> = {
  sm: { svg: 'w-[30px] h-[40px] md:w-14 md:h-[72px]', text: 'text-[11px] md:text-sm' },
  md: { svg: 'w-[46px] h-[60px] md:w-[72px] md:h-[92px]', text: 'text-xs md:text-base' },
  lg: { svg: 'w-[64px] h-[82px] md:w-24 md:h-[122px]', text: 'text-sm md:text-lg' },
};

const HourglassTimer = ({ duration, onExpire, phase, lobbyCode, size = 'md', hidden = false }: HourglassTimerProps) => {
  const { timeLeft, endTime, serverDuration } = useSyncedTimer(duration, { onExpire, phase, lobbyCode });

  const [progress, setProgress] = useState(100);
  const [remainingSec, setRemainingSec] = useState(duration);
  const rafRef = useRef<number | null>(null);

  // Durée de référence pour le calcul de progress : priorité au serveur (vraie durée démarrée)
  const effectiveDuration = serverDuration ?? duration;

  useEffect(() => {
    const tick = () => {
      let remainingMs: number;
      if (endTime === null) {
        remainingMs = timeLeft * 1000;
      } else {
        remainingMs = Math.max(0, endTime - Date.now());
      }
      const p = Math.max(0, Math.min(100, (remainingMs / (effectiveDuration * 1000)) * 100));
      setProgress(p);
      setRemainingSec(Math.ceil(remainingMs / 1000));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [endTime, effectiveDuration, timeLeft]);

  const sizeClass = SIZE_CLASSES[size];
  const isCritical = progress <= 15;
  const isWarning = progress <= 35 && !isCritical;
  const sandColor = isCritical ? '#e53e3e' : isWarning ? '#f39c12' : '#d4a574';
  const glassStroke = '#1a1a1a';
  const bulbFill = 'rgba(255, 255, 255, 0.35)';

  // Géométrie : viewBox 100×130. Col entre y=60 et y=70.
  // Top bulb : trapèze inversé (points larges en haut, rétrécit vers le col)
  // Bottom bulb : trapèze (étroit en haut, large en bas)
  // On anime la hauteur du sable dans chaque bulb via un clipPath horizontal.
  const topSandH = 45 * (progress / 100); // 0 à 45
  const bottomSandH = 45 * (1 - progress / 100);

  const grainCount = isCritical ? 6 : 3;
  const grains = useMemo(
    () => Array.from({ length: grainCount }, (_, i) => ({
      id: i,
      delay: (i * 0.9) / grainCount,
      offsetX: (i % 2 === 0 ? -1 : 1) * (0.3 + (i * 0.4)),
    })),
    [grainCount]
  );

  if (hidden) return null;

  return (
    <div className={`inline-flex flex-row items-center gap-1.5 md:gap-2 ${isCritical ? 'animate-hourglass-nudge' : ''}`}>
      <span
        className={`font-display font-bold leading-none tabular-nums ${sizeClass.text} ${
          isCritical ? 'text-red-600' : isWarning ? 'text-orange-500' : 'text-gray-700'
        }`}
      >
        {Math.max(0, remainingSec)}s
      </span>
      <svg viewBox="0 0 100 130" className={`${sizeClass.svg} drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]`}>
        {/* Plateaux bois haut/bas */}
        <rect x="8" y="4" width="84" height="9" rx="2" fill="#8b5a2b" stroke={glassStroke} strokeWidth="3" strokeLinejoin="round" />
        <rect x="8" y="117" width="84" height="9" rx="2" fill="#8b5a2b" stroke={glassStroke} strokeWidth="3" strokeLinejoin="round" />

        {/* Silhouette verre : top bulb */}
        <path
          d="M 20 13 L 80 13 L 56 63 Q 50 68 44 63 Z"
          fill={bulbFill}
          stroke={glassStroke}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Silhouette verre : bottom bulb */}
        <path
          d="M 44 67 Q 50 62 56 67 L 80 117 L 20 117 Z"
          fill={bulbFill}
          stroke={glassStroke}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Sable top : on remplit depuis le bas du bulb vers le haut */}
        <defs>
          <clipPath id="top-bulb-clip">
            <path d="M 20 13 L 80 13 L 56 63 Q 50 68 44 63 Z" />
          </clipPath>
          <clipPath id="bottom-bulb-clip">
            <path d="M 44 67 Q 50 62 56 67 L 80 117 L 20 117 Z" />
          </clipPath>
        </defs>

        {/* Sable dans le bulb du haut — rectangle qui descend en hauteur */}
        <rect
          x="10"
          y={63 - topSandH}
          width="80"
          height={topSandH + 2}
          fill={sandColor}
          clipPath="url(#top-bulb-clip)"
          style={{ transition: 'y 0.4s linear, height 0.4s linear, fill 0.5s ease' }}
        />

        {/* Sable dans le bulb du bas — rectangle qui remplit par le bas */}
        <rect
          x="10"
          y={117 - bottomSandH}
          width="80"
          height={bottomSandH + 2}
          fill={sandColor}
          clipPath="url(#bottom-bulb-clip)"
          style={{ transition: 'y 0.4s linear, height 0.4s linear, fill 0.5s ease' }}
        />

        {/* Grains en chute dans le col */}
        {progress > 0 && progress < 100 && grains.map(g => (
          <circle
            key={g.id}
            cx={50 + g.offsetX}
            cy={63}
            r={isCritical ? 1.4 : 1.1}
            fill={sandColor}
            className="hourglass-grain"
            style={{ animationDelay: `${g.delay}s` }}
          />
        ))}

        {/* Petit tas sur le fond du bulb du bas, animé */}
        {progress < 100 && (
          <ellipse
            cx="50"
            cy={117 - Math.max(2, bottomSandH * 0.35)}
            rx={Math.min(18, 4 + bottomSandH * 0.35)}
            ry="2.5"
            fill={sandColor}
            opacity="0.85"
            clipPath="url(#bottom-bulb-clip)"
            style={{ transition: 'cy 0.4s linear, rx 0.4s linear, fill 0.5s ease' }}
          />
        )}
      </svg>
    </div>
  );
};

export default HourglassTimer;
