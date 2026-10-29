import { useState } from 'react';
import { Icon } from '@iconify/react';
import { SectionHeader } from './SectionHeader';
import { LEGAL_CONTENT, LEGAL_LABELS_FR } from './shared';
import { PANEL } from '../ui';

export const LegalSection = () => {
  const entries = Object.entries(LEGAL_CONTENT).filter(
    (entry): entry is [keyof typeof LEGAL_CONTENT, Extract<typeof LEGAL_CONTENT[keyof typeof LEGAL_CONTENT], { title: string }>] =>
      typeof entry[1] === 'object' && 'title' in entry[1],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div>
      <SectionHeader title="Pages légales" />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Textes ouverts depuis le pied de page du site : À propos, Mentions légales, Confidentialité et Contact.
      </p>
      <div className="space-y-3">
        {entries.map(([key, block]) => {
          const sections = 'sections' in block ? block.sections : [];
          const isOpen = openKey === key;
          return (
            <div
              key={key}
              className={`${PANEL} overflow-hidden`}
            >
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                aria-expanded={isOpen}
                className={`cursor-pointer w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-white/[0.03] transition-colors ${isOpen ? 'border-b border-white/[0.06]' : ''}`}
              >
                <Icon
                  icon="mdi:chevron-right"
                  className={`w-4 h-4 shrink-0 text-white/50 transition-transform ${isOpen ? 'rotate-90 text-amber-300' : ''}`}
                  aria-hidden
                />
                <span className="text-[14px] font-semibold tracking-tight text-white">
                  {LEGAL_LABELS_FR[key] ?? block.title}
                </span>
                {sections.length > 0 && (
                  <span className="ml-auto text-[12px] text-white/55">
                    {sections.length} rubrique{sections.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>
              {!isOpen ? null : sections.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-white/55">
                  Pas de texte : cette page renvoie vers le formulaire de contact.
                </p>
              ) : (
                <div className="divide-y divide-white/[0.06]">
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
                            <li key={j} className="flex gap-2 text-[13px] text-white/70 leading-snug">
                              <span className="text-white/30 shrink-0">·</span>
                              <span>{li}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {'extra' in s && s.extra && (
                        <div
                          className="mt-2 text-[13px] text-white/60 leading-snug [&_a]:text-sky-300 [&_a]:underline"
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
