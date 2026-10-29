import { SectionHeader } from './SectionHeader';
import { FUN_FACTS } from './shared';
import { PANEL } from '../ui';

export const FunFactsSection = () => (
  <div>
    <SectionHeader title="Le saviez-vous ?" />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Anecdotes montrées aux autres joueurs pendant que le pilier choisit sa question, une nouvelle toutes les
      15 secondes.
    </p>
    <div className={`${PANEL} overflow-hidden`}>
      <ol className="divide-y divide-white/[0.06]">
        {FUN_FACTS.map((f, i) => (
          <li
            key={i}
            className="flex gap-3 px-4 py-2.5 text-[13px] text-white/85 leading-snug"
          >
            <span className="text-[12px] tabular-nums text-white/45 shrink-0 w-6 text-right">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="whitespace-pre-wrap break-words">{f}</span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);
