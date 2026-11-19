import { DRAWING_IDEAS } from '../../../i18n/drawingIdeas';
import { ideaArity, type DrawingIdea } from '../../../utils/whiteboard';
import { SectionHeader } from './SectionHeader';
import { PREVIEW_TOP_PLAYERS } from './shared';
import { PANEL } from '../ui';

// Pseudos d'exemple pour les idées « à nom », surlignés dans le rendu.
const [A, B] = PREVIEW_TOP_PLAYERS.map((p) => p.name);
const NAME_SPLIT = new RegExp(`(${A}|${B})`);

const GROUPS: { arity: 0 | 1 | 2; title: string; hint: string }[] = [
  { arity: 0, title: 'Classiques', hint: 'Une idée fixe' },
  { arity: 1, title: 'Un joueur', hint: `Pseudo d'un joueur de la partie (ici ${A})` },
  { arity: 2, title: 'Duo', hint: `Deux joueurs différents (ici ${A} et ${B})` },
];

const IdeaText = ({ idea }: { idea: DrawingIdea }) => {
  const text = typeof idea === 'string' ? idea : idea(A, B);
  if (typeof idea === 'string') return <>{text}</>;
  return (
    <>
      {text.split(NAME_SPLIT).map((part, i) =>
        part === A || part === B
          ? <span key={i} className="font-semibold text-sky-300">{part}</span>
          : part,
      )}
    </>
  );
};

export const DrawingIdeasSection = () => (
  <div>
    <SectionHeader title="Idées de dessin" hint={`${DRAWING_IDEAS.length} idées`} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Proposées en haut du tableau blanc pendant que le pilier choisit sa question, une par manche, la même pour
      tout le salon. Mélangées à chaque partie. Se modifient dans <code className="font-mono text-[12px] text-white/70">frontend/src/i18n/drawingIdeas.ts</code>.
    </p>
    <div className="space-y-5">
      {GROUPS.map((g) => {
        const ideas = DRAWING_IDEAS.filter((idea) => ideaArity(idea.fr) === g.arity);
        if (ideas.length === 0) return null;
        return (
          <div key={g.arity}>
            <SectionHeader title={`${g.title} (${ideas.length})`} hint={g.hint} />
            <div className={`${PANEL} overflow-hidden`}>
              <ol className="divide-y divide-white/[0.06]">
                {ideas.map((idea, i) => (
                  <li
                    key={i}
                    className="flex gap-3 px-4 py-2.5 text-[13px] leading-snug"
                  >
                    <span className="text-[12px] tabular-nums text-white/45 shrink-0 w-6 text-right">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className="text-white/85 break-words"><IdeaText idea={idea.fr} /></span>
                      <span className="text-white/45 break-words"><IdeaText idea={idea.en} /></span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
