import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { IPlayer, IRound, LeaderboardEntry } from '@onskone/shared';
import Avatar from '../Avatar';
import { useLocale } from '../../i18n';

interface ScoreLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  currentPlayer: IPlayer | null;
  /** Round où chaque joueur a été pilier (pour afficher sa question reçue). */
  roundByLeaderId: Map<string, IRound>;
  /** Map id joueur -> nom (pour résoudre les répondants d'un round). */
  playerNameById: Map<string, string>;
  /** Pilote l'apparition (fade/translate + stagger des lignes). */
  showLeaderboard: boolean;
}

const PODIUM_COLORS = [
  'var(--color-podium-gold)',
  'var(--color-podium-silver)',
  'var(--color-podium-bronze)',
];

/**
 * Carte des scores individuels (classement final) avec, pour chaque joueur
 * ayant été pilier, un popover montrant sa question reçue et les répondants.
 * L'état d'ouverture/animation du popover est local à ce composant.
 */
const ScoreLeaderboard: React.FC<ScoreLeaderboardProps> = ({
  leaderboard,
  currentPlayer,
  roundByLeaderId,
  playerNameById,
  showLeaderboard,
}) => {
  const { t } = useLocale();

  const [openPopoverFor, setOpenPopoverFor] = useState<string | null>(null);
  const [renderedPopoverFor, setRenderedPopoverFor] = useState<string | null>(null);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Gestion mount/unmount différé pour permettre l'animation de fermeture
  useEffect(() => {
    if (openPopoverFor) {
      setRenderedPopoverFor(openPopoverFor);
      // Double rAF pour s'assurer que l'état "closed" est peint avant le passage à "open"
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setPopoverVisible(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        if (r2) cancelAnimationFrame(r2);
      };
    }
    setPopoverVisible(false);
    if (renderedPopoverFor) {
      const timeout = setTimeout(() => setRenderedPopoverFor(null), 220);
      return () => clearTimeout(timeout);
    }
  }, [openPopoverFor, renderedPopoverFor]);

  // Fermeture sur clic en dehors
  useEffect(() => {
    if (!openPopoverFor) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopoverFor(null);
      }
    };
    const timeout = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [openPopoverFor]);

  return (
    <div
      className={`bg-white border-[2.5px] border-black rounded-2xl stack-shadow texture-paper p-3 md:p-5 transition-all duration-500 ${showLeaderboard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <h2 className="text-base md:text-xl font-display font-bold text-gray-900 mb-2 md:mb-3 text-center uppercase tracking-wider m-0">
        {t.endGame.individualScores}
      </h2>
      <div className="space-y-1.5 md:space-y-2">
        {leaderboard.map((entry, index) => {
          const isCurrentPlayer = entry.player.id === currentPlayer?.id;
          const isPodium = index < 3;
          const round = roundByLeaderId.get(entry.player.id);
          const hasQuestion = !!(round && round.selectedQuestion);
          const isOpen = openPopoverFor === entry.player.id;
          const isRendered = renderedPopoverFor === entry.player.id;
          const respondentNames = round
            ? Object.keys(round.answers || {})
              .filter(id => id !== entry.player.id)
              .map(id => playerNameById.get(id))
              .filter((n): n is string => !!n)
            : [];
          return (
            <div
              key={entry.player.id}
              className={`flex items-center justify-between p-2 md:p-3 rounded-xl border-[2.5px] border-black animate-player-pop ${isCurrentPlayer ? 'bg-warning-100 stack-shadow-sm' : 'bg-cream-player'}`}
              style={{ animationDelay: `${(showLeaderboard ? 0 : 99999) + index * 80}ms` }}
            >
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <span
                  className="flex items-center justify-center text-sm md:text-base w-7 h-7 md:w-9 md:h-9 flex-shrink-0 font-display font-bold tabular-nums rounded-full border-2 border-black"
                  style={{
                    backgroundColor: isPodium ? PODIUM_COLORS[index] : '#ffffff',
                    color: isPodium && index === 0 ? '#000' : '#1f2937',
                  }}
                >
                  {index + 1}
                </span>
                <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="sm" className="flex-shrink-0 md:hidden" />
                <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="md" className="flex-shrink-0 hidden md:block" />
                <span className="text-sm md:text-lg font-semibold truncate text-gray-900">
                  {entry.player.name}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-base md:text-xl font-display font-bold tabular-nums text-gray-900">
                  {t.endGame.points(entry.score)}
                </span>
                {hasQuestion && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={t.endGame.aria.seeReceivedQuestion}
                      aria-expanded={isOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPopoverFor(isOpen ? null : entry.player.id);
                      }}
                      className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full border-[2px] border-black bg-white hover:bg-gray-100 active:scale-95 transition-transform cursor-pointer text-gray-800"
                    >
                      <Icon icon="mdi:message-question-outline" width="1.05em" height="1.05em" aria-hidden />
                    </button>
                    {isRendered && round && (
                      <div
                        ref={isOpen ? popoverRef : undefined}
                        data-state={isOpen && popoverVisible ? 'open' : 'closed'}
                        className="absolute right-0 bottom-full mb-2 w-60 md:w-72 z-30 bg-white border-[2.5px] border-black rounded-xl stack-shadow p-3 md:p-3.5 popover-anim text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 leading-tight">
                          {t.endGame.receivedQuestion}
                        </p>
                        <p className="text-sm md:text-base font-semibold text-gray-900 mb-2.5 leading-snug">
                          « {round.selectedQuestion} »
                        </p>
                        <p className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 leading-tight">
                          {t.endGame.correctAnswersCount(respondentNames.length)}
                        </p>
                        {respondentNames.length > 0 ? (
                          <p className="text-sm text-gray-900 leading-snug">
                            {respondentNames.join(', ')}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 italic">{t.endGame.noPlayers}</p>
                        )}
                        <span className="popover-notch" aria-hidden />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScoreLeaderboard;
