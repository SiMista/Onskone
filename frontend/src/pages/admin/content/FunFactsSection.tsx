import { SectionHeader } from './SectionHeader';
import { FUN_FACTS } from './shared';

export const FunFactsSection = () => (
  <div>
    <SectionHeader title="Saviez-vous" count={FUN_FACTS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Affichés en rotation pendant les phases d'attente pour faire patienter les joueurs.
    </p>
    <div className="rounded-lg surface-glass overflow-hidden">
      <ol>
        {FUN_FACTS.map((f, i) => (
          <li
            key={i}
            className="flex gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-b-0 text-[13px] text-white/85 leading-snug"
          >
            <span className="font-mono text-[11px] tabular-nums text-white/30 shrink-0 w-6 text-right mt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="whitespace-pre-wrap break-words">{f}</span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);
