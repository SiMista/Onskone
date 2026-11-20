import { DRAWING_PORTRAIT_EVERY, DRAWING_PORTRAIT_ID } from '@onskone/shared';
import { DRAWING_IDEAS, type DrawingIdeaText } from '../../../i18n/drawingIdeas';
import { SectionHeader } from './SectionHeader';
import { PREVIEW_TOP_PLAYERS } from './shared';
import { PANEL } from '../ui';

// Pseudo d'exemple pour le portrait, surligné dans le rendu.
const SAMPLE = PREVIEW_TOP_PLAYERS[0].name;

const IdeaText = ({ idea }: { idea: DrawingIdeaText }) => {
  if (typeof idea === 'string') return <>{idea}</>;
  return (
    <>
      {idea(SAMPLE).split(SAMPLE).flatMap((part, i) =>
        i === 0 ? [part] : [<span key={i} className="font-semibold text-sky-300">{SAMPLE}</span>, part],
      )}
    </>
  );
};

const ENTRIES = Object.entries(DRAWING_IDEAS);
const GROUPS = [
  { title: 'Idées simples', hint: 'Animaux, objets, nature…', entries: ENTRIES.filter(([id]) => id !== DRAWING_PORTRAIT_ID) },
  { title: 'Portrait', hint: `Un joueur de la partie, à tour de rôle (ici ${SAMPLE})`, entries: ENTRIES.filter(([id]) => id === DRAWING_PORTRAIT_ID) },
];

export const DrawingIdeasSection = () => (
  <div>
    <SectionHeader title="Idées de dessin" hint={`${ENTRIES.length} idées`} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Une idée par manche, la même pour tout le salon. Un portrait toutes les {DRAWING_PORTRAIT_EVERY} manches
      (place au hasard), sinon une idée simple, sans redite.
    </p>
    <div className="space-y-5">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <SectionHeader title={`${g.title} (${g.entries.length})`} hint={g.hint} />
          {/* Tableau en colonnes (2 sur téléphone, 3 au-delà), FR seulement : c'est une liste à survoler. */}
          <div className={`${PANEL} px-4 py-2`}>
            <ol className="grid grid-cols-2 md:grid-cols-3 gap-x-4">
              {g.entries.map(([id, idea], i) => (
                <li key={id} className="flex items-baseline gap-2 py-1.5 text-[13px] leading-snug min-w-0">
                  <span className="text-[12px] tabular-nums text-white/40 shrink-0 w-5 text-right">{i + 1}</span>
                  <span className="text-white/85 break-words min-w-0"><IdeaText idea={idea.fr} /></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  </div>
);
