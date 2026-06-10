import { Icon } from '@iconify/react';
import { STICKER_FILTER } from '../../constants/icons';
import { PUBLIC_TIERS, ONSKONE_INDEX, type Tier } from '../../constants/tiers';
import { useLocale } from '../../i18n';

interface VerdictRingProps {
  /** % affiché en direct pendant l'animation de comptage. */
  displayPct: number;
  /** Tier correspondant au displayPct (couleur live de l'anneau). */
  liveVerdict: Tier;
  /** Message de verdict tiré du tier final. */
  verdictMessage: string;
  /** Vrai une fois l'animation de comptage terminée. */
  revealed: boolean;
  /** Vrai quand le climax Onskoné (score parfait) est déclenché. */
  onskoneRevealed: boolean;
  /** Index du tier courant à partir d'un %. */
  getTierIndex: (pct: number) => number;
}

/**
 * Anneau de progression central de l'EndGame : pourcentage géant, jalons des
 * tiers répartis sur le cercle, et pop "Onskoné" (climax violet intentionnel)
 * sur un score parfait. Rendu purement présentationnel, piloté par l'état
 * d'animation calculé dans EndGame.
 */
const VerdictRing: React.FC<VerdictRingProps> = ({
  displayPct,
  liveVerdict,
  verdictMessage,
  revealed,
  onskoneRevealed,
  getTierIndex,
}) => {
  const { t } = useLocale();

  const ringRadius = 110;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (displayPct / 100) * ringCircumference;

  return (
    <div className="flex flex-col items-center mb-5 md:mb-8 mt-2 md:mt-4">
      <div
        className="relative flex flex-col items-center px-5 pt-5 pb-4"
        style={{ overflow: 'visible' }}
      >
        {/* Fond glass derrière le halo dark (z-0 < halo z-10 < contenu z-20) */}
        <div
          className="absolute inset-0 rounded-3xl border border-white/20 bg-white/[0.07] backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.15)]"
          style={{ zIndex: 0 }}
          aria-hidden
        />
        <p className="relative z-20 text-white/80 font-display text-sm md:text-lg uppercase tracking-[0.25em]">
          {t.endGame.eyebrow}
        </p>

        <div className="relative z-20 w-[min(320px,52dvh)] h-[min(320px,52dvh)] md:w-[min(380px,55dvh)] md:h-[min(380px,55dvh)] max-w-full -mt-6 md:-mt-8">
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(200px,34dvh)] h-[min(200px,34dvh)] md:w-[min(250px,38dvh)] md:h-[min(250px,38dvh)] -rotate-90 overflow-visible" viewBox="0 0 240 240" style={{ overflow: 'visible' }}>
            <defs>
              <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
              </filter>
            </defs>
            <circle
              cx="120"
              cy="120"
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="18"
            />
            {revealed && (
              <circle
                cx="120"
                cy="120"
                r={ringRadius}
                fill="none"
                stroke={liveVerdict.color}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                opacity="0.7"
                filter="url(#ring-glow)"
                style={{ transition: 'stroke 0.5s ease' }}
              />
            )}
            <circle
              cx="120"
              cy="120"
              r={ringRadius}
              fill="none"
              stroke={liveVerdict.color}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              style={{ transition: 'stroke 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-baseline">
              <span
                className="font-display font-bold text-white text-6xl md:text-8xl leading-none tabular-nums"
                style={{ textShadow: '0 2px 14px rgba(0,0,0,0.35)' }}
              >
                {displayPct}
              </span>
              <span
                className="font-display font-bold text-4xl md:text-5xl ml-1"
                style={{ color: liveVerdict.color, transition: 'color 0.5s ease' }}
              >
                %
              </span>
            </div>
          </div>

          {onskoneRevealed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="absolute w-32 h-32 md:w-40 md:h-40 rounded-full border-2 animate-onskone-shockwave" style={{ borderColor: '#b46cff' }} />
              <div className="absolute w-32 h-32 md:w-40 md:h-40 rounded-full border-2 animate-onskone-shockwave" style={{ borderColor: '#d9b3ff', animationDelay: '0.25s' }} />
              <div
                className="relative flex flex-col items-center justify-center px-5 py-3 rounded-2xl animate-onskone-pop"
                style={{
                  background: 'linear-gradient(135deg, #b46cff 0%, #8e3dff 100%)',
                  boxShadow: '0 0 32px rgba(180,108,255,0.7), 0 0 64px rgba(180,108,255,0.35), 0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <Icon icon="fluent-emoji-flat:partying-face" className="text-4xl md:text-5xl" width="1em" height="1em" aria-hidden style={{ filter: STICKER_FILTER }} />
                <span
                  className="font-display font-bold text-white text-xl md:text-2xl mt-1 tracking-wide"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}
                >
                  {t.endGame.perfectBadge}
                </span>
              </div>
            </div>
          )}

          {PUBLIC_TIERS.map((tier, idx) => {
            const rawIdx = getTierIndex(displayPct);
            const currentIdx = Math.min(ONSKONE_INDEX - 1, rawIdx);
            const isActive = idx === currentIdx && !onskoneRevealed;
            const isPassed = currentIdx > idx || onskoneRevealed;
            const a = (tier.midPct / 100) * 360 * Math.PI / 180;
            const radius = 40;
            const x = 50 + Math.sin(a) * radius;
            const y = 50 - Math.cos(a) * radius;
            const tierTitle = t.endGame.tiers[idx]?.title ?? '';
            return (
              <div
                key={idx}
                className="absolute flex flex-col items-center text-center whitespace-nowrap"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%) scale(${isActive ? 1.15 : isPassed ? 0.92 : 0.8})`,
                  opacity: isActive ? 1 : isPassed ? 0.7 : 0.28,
                  transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease, filter 0.4s ease',
                  filter: isActive ? `drop-shadow(0 0 10px ${tier.color}) drop-shadow(0 0 4px ${tier.color})` : 'none',
                }}
              >
                <Icon
                  icon={tier.icon}
                  className={isActive ? 'text-3xl md:text-4xl' : 'text-lg md:text-xl'}
                  width="1em"
                  height="1em"
                  aria-hidden
                />
                <span
                  className={`font-display font-bold mt-0.5 md:mt-1 ${isActive ? 'text-sm md:text-base' : 'text-[10px] md:text-xs'}`}
                  style={{
                    color: isActive || isPassed ? tier.color : 'rgba(255,255,255,0.85)',
                    textShadow: isActive
                      ? '0 0 6px rgba(0,0,0,0.55), 0 0 12px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.6)'
                      : '0 0 5px rgba(0,0,0,0.5), 0 0 10px rgba(0,0,0,0.35)',
                    letterSpacing: isActive ? '0.02em' : '0',
                  }}
                >
                  {tierTitle}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className={`relative z-20 -mt-2 md:-mt-4 text-center px-4 transition-all duration-500 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
        >
          <p className="text-white text-sm md:text-base font-display italic max-w-md mx-auto">
            « {verdictMessage} »
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerdictRing;
