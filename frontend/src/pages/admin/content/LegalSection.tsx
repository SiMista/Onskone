import { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { LEGAL_CONTENT, LEGAL_LABELS_FR } from './shared';

export const LegalSection = () => {
  const entries = Object.entries(LEGAL_CONTENT).filter(
    (entry): entry is [keyof typeof LEGAL_CONTENT, Extract<typeof LEGAL_CONTENT[keyof typeof LEGAL_CONTENT], { title: string }>] =>
      typeof entry[1] === 'object' && 'title' in entry[1],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div>
      <SectionHeader title="Contenu légal" count={entries.length} />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Textes affichés depuis le pied de page du site : À propos, Mentions légales, Confidentialité et Contact.
      </p>
      <div className="space-y-3">
        {entries.map(([key, block]) => {
          const sections = 'sections' in block ? block.sections : [];
          const isOpen = openKey === key;
          return (
            <div
              key={key}
              className="rounded-lg surface-glass overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                className={`w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-white/[0.03] transition-colors ${isOpen ? 'border-b border-white/[0.05]' : ''}`}
              >
                <svg
                  className={`w-3.5 h-3.5 text-white/50 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                </svg>
                <p className="text-[15px] font-semibold tracking-tight text-white">
                  {LEGAL_LABELS_FR[key] ?? block.title}
                </p>
                {sections.length > 0 && (
                  <span className="ml-auto text-[12px] text-white/40">
                    {sections.length} rubrique{sections.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>
              {!isOpen ? null : sections.length === 0 ? (
                <p className="px-4 py-3 text-[12.5px] text-white/40 italic">
                  Aucun texte (la page renvoie vers un formulaire de contact).
                </p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {sections.map((s, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-amber-200/90 mb-1.5">
                        {s.title}
                      </p>
                      <div
                        className="text-[13px] text-white/80 leading-relaxed [&_a]:text-sky-300 [&_a]:underline [&_strong]:text-white"
                        dangerouslySetInnerHTML={{ __html: s.content }}
                      />
                      {'list' in s && Array.isArray(s.list) && (
                        <ul className="mt-2 space-y-1">
                          {s.list.map((li, j) => (
                            <li key={j} className="flex gap-2 text-[12.5px] text-white/70 leading-snug">
                              <span className="text-white/30 shrink-0">·</span>
                              <span>{li}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {'extra' in s && s.extra && (
                        <div
                          className="mt-2 text-[12.5px] text-white/60 leading-snug [&_a]:text-sky-300 [&_a]:underline"
                          dangerouslySetInnerHTML={{ __html: s.extra }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
