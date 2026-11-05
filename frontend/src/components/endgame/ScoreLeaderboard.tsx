import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { IPlayer, IRound, LeaderboardEntry } from '@onskone/shared';
import Avatar from '../Avatar';
import PremiumName from '../PremiumName';
import AnswerText from '../AnswerText';
import { useLocale } from '../../i18n';

interface ScoreLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  currentPlayer: IPlayer | null;
  /** Round où chaque joueur a été pilier (pour afficher sa question reçue). */
  roundByLeaderId: Map<string, IRound>;
  /** Map id joueur -> nom (pour résoudre les joueurs bien devinés d'un round). */
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
 * ayant été pilier, un popover montrant sa question reçue, son nombre de bonnes
 * réponses, et un bouton par joueur (✓ bien deviné / ✗ raté) qui affiche sa réponse.
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

  // Seul le pilier marque des points : un joueur qui ne l'a jamais été (exclu par
  // l'hôte, ou partie écourtée) finirait dernier à 0 pt sans l'avoir mérité. Il
  // passe sous le classement, sans rang. Sans aucun round connu, on classe tout le monde.
  const hasLed = (id: string) => roundByLeaderId.size === 0 || roundByLeaderId.has(id);
  const rows = [
    ...leaderboard.filter(e => hasLed(e.player.id)),
    ...leaderboard.filter(e => !hasLed(e.player.id)),
  ];

  const [openPopoverFor, setOpenPopoverFor] = useState<string | null>(null);
  const [renderedPopoverFor, setRenderedPopoverFor] = useState<string | null>(null);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // Joueur dont la réponse est affichée dans le popover ouvert (un seul à la fois).
  const [shownAuthorId, setShownAuthorId] = useState<string | null>(null);

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

  // Le popover s'ouvre SOUS la ligne, à l'intérieur de la liste scrollable : sans
  // défilement il sortait en partie de la zone visible (bas coupé). On défile une
  // fois l'animation d'ouverture TERMINÉE (transition de 220 ms dans EndGame) :
  // mesuré plus tôt, il est encore réduit à scale(0.7) et le défilement « nearest »
  // s'arrêtait 30 % trop court, laissant le bas de la bulle sous le bord.
  useEffect(() => {
    if (!openPopoverFor || !popoverVisible) return;
    const timeout = setTimeout(() => {
      popoverRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 240);
    return () => clearTimeout(timeout);
  }, [openPopoverFor, popoverVisible]);

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
      className={`bg-white card-paper rounded-2xl stack-shadow p-3 md:p-5 transition-all duration-500 ${showLeaderboard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <h2 className="text-base md:text-xl font-display font-bold text-gray-900 mb-2 md:mb-3 text-center uppercase tracking-wider m-0">
        {t.endGame.individualScores}
      </h2>
      {/* Pas de scroll imbriqué : la liste prend sa hauteur naturelle et c'est TOUTE la page
          de fin qui défile (un 2e scroller dans la carte piégeait la molette/le doigt). */}
      <div className="relative">
        <div
          className="space-y-1.5 md:space-y-2 pt-1"
        >
        {rows.map((entry, index) => {
          const isCurrentPlayer = entry.player.id === currentPlayer?.id;
          const isRanked = hasLed(entry.player.id);
          const isPodium = isRanked && index < 3;
          const round = roundByLeaderId.get(entry.player.id);
          const hasQuestion = !!(round && round.selectedQuestion);
          const isOpen = openPopoverFor === entry.player.id;
          const isRendered = renderedPopoverFor === entry.player.id;
          // Réponses du round (fin de partie = phase REVEAL, donc exposées par le
          // serveur), chacune marquée bien devinée ou non (liste calculée par le
          // serveur, cohérente avec le score). En mode "Devine ma réponse", l'entrée
          // portant l'id du PILIER est la réponse que le substitut a écrite à sa
          // place : on affiche le nom du pilier suivi de l'auteur réel, ex.
          // « Bob (par Alice) ». Sans ça, le substitut apparaissait deux fois.
          const substituteName = round?.substitutePlayerId
            ? playerNameById.get(round.substitutePlayerId)
            : undefined;
          const correctIds = new Set(round?.correctPlayerIds ?? []);
          const leaderName = playerNameById.get(entry.player.id);
          const answerEntries = [
            ...Object.entries(round?.answers ?? {}).map(([id, text]) => ({ id, label: playerNameById.get(id), text })),
            ...(round?.guessMyAnswerMode && round.substituteAnswer && substituteName && leaderName
              ? [{ id: entry.player.id, label: `${leaderName} ${t.endGame.byPlayer(substituteName)}`, text: round.substituteAnswer }]
              : []),
          ].filter((a): a is { id: string; label: string; text: string } => !!a.label);
          const shownEntry = isOpen ? answerEntries.find(a => a.id === shownAuthorId) : undefined;
          // Bonnes réponses RÉELLES du pilier sur son round : le score qu'il y a
          // marqué (1 point par attribution juste, bonus de similarité inclus).
          const correctCount = round?.scores?.[entry.player.id] ?? 0;
          return (
            <div
              key={entry.player.id}
              // `relative z-20` sur la ligne qui porte le popover : l'animation
              // `animate-player-pop` (fill-mode both) laisse un transform sur chaque
              // ligne, donc chacune est un contexte d'empilement et le `z-30` du
              // popover reste enfermé dans la sienne. Ouvert vers le BAS, il passait
              // derrière les lignes suivantes (peintes après). Remonter la ligne
              // entière au-dessus de ses sœurs le fait repasser devant.
              className={`flex items-center justify-between p-2 md:p-3 rounded-xl border-[2.5px] border-black animate-player-pop ${isRendered ? 'relative z-20' : ''} ${isCurrentPlayer ? 'bg-warning-100 stack-shadow-sm' : 'bg-cream-player'}`}
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
                  {isRanked ? index + 1 : '–'}
                </span>
                <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="sm" premium={entry.player.isPremium} className="flex-shrink-0 md:hidden" />
                <Avatar avatarId={entry.player.avatarId} name={entry.player.name} size="md" premium={entry.player.isPremium} className="flex-shrink-0 hidden md:block" />
                <PremiumName
                  name={entry.player.name}
                  premium={entry.player.isPremium}
                  className="text-sm md:text-lg font-semibold truncate text-gray-900"
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {isRanked ? (
                  <span className="text-base md:text-xl font-display font-bold tabular-nums text-gray-900">
                    {t.endGame.points(entry.score)}
                  </span>
                ) : (
                  <span className="text-display-xs text-gray-500 text-right">
                    {t.endGame.unranked}
                  </span>
                )}
                {hasQuestion && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={t.endGame.aria.seeReceivedQuestion}
                      aria-expanded={isOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPopoverFor(isOpen ? null : entry.player.id);
                        setShownAuthorId(null);
                      }}
                      className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full border-[2px] border-black bg-white hover:bg-gray-100 active:scale-95 transition-transform cursor-pointer text-gray-800"
                    >
                      <Icon icon="mdi:message-question-outline" width="1.05em" height="1.05em" aria-hidden />
                    </button>
                    {isRendered && round && (
                      <div
                        ref={isOpen ? popoverRef : undefined}
                        data-state={isOpen && popoverVisible ? 'open' : 'closed'}
                        className="absolute right-0 top-full mt-2 scroll-mb-3 w-60 md:w-72 z-30 bg-white border-[2.5px] border-black rounded-xl stack-shadow p-3 md:p-3.5 popover-anim text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 leading-tight">
                          {t.endGame.receivedQuestion}
                        </p>
                        <p className="text-sm md:text-base font-semibold text-gray-900 mb-2.5 leading-snug">
                          « {round.selectedQuestion} »
                        </p>
                        <p className="text-xs font-display font-bold uppercase tracking-wider text-gray-500 leading-tight">
                          {t.endGame.correctAnswersCount(correctCount)}
                        </p>
                        {answerEntries.length > 0 && (
                          <>
                            <p className="mt-1 text-xs text-gray-500 leading-tight">{t.endGame.answersHint}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {answerEntries.map(a => {
                                const correct = correctIds.has(a.id);
                                const shown = shownEntry?.id === a.id;
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    aria-pressed={shown}
                                    onClick={() => setShownAuthorId(shown ? null : a.id)}
                                    className={`inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full border-2 border-black text-xs font-semibold text-gray-900 cursor-pointer active:scale-95 transition-transform ${shown ? 'bg-cream-answer stack-shadow-sm' : 'bg-white hover:bg-gray-100'}`}
                                  >
                                    <Icon
                                      icon={correct ? 'mdi:check-bold' : 'mdi:close-thick'}
                                      width="1.1em"
                                      height="1.1em"
                                      className={`shrink-0 ${correct ? 'text-success-700' : 'text-danger-500'}`}
                                      aria-label={correct ? t.phases.reveal.authorCorrect : t.phases.reveal.authorWrong}
                                    />
                                    <span className="truncate">{a.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {shownEntry && (
                              <div className="mt-2 rounded-lg border-2 border-black bg-cream-answer px-2.5 py-1.5">
                                <AnswerText text={shownEntry.text} className="m-0 text-sm leading-snug break-words" />
                              </div>
                            )}
                          </>
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
    </div>
  );
};

export default ScoreLeaderboard;
