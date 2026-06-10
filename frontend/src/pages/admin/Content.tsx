import { useState } from 'react';
import { ContentSection, CONTENT_SECTIONS } from './content/shared';
import { TiersSection } from './content/TiersSection';
import { FunFactsSection } from './content/FunFactsSection';
import { AchievementsSection } from './content/AchievementsSection';
import { AvatarsSection } from './content/AvatarsSection';
import { LegalSection } from './content/LegalSection';
import { ConstantsSection } from './content/ConstantsSection';

export const ContentPanel = () => {
  const [section, setSection] = useState<ContentSection>('tiers');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {CONTENT_SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-2.5 py-1.5 sm:py-1 rounded-md border font-mono text-[11px] uppercase tracking-wider transition-colors ${active
                ? 'bg-white/[0.08] border-white/15 text-white'
                : 'bg-transparent border-white/[0.06] text-white/45 hover:text-white/85 hover:border-white/15'
                }`}
              title={s.hint}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div>
        {section === 'tiers' && <TiersSection />}
        {section === 'funfacts' && <FunFactsSection />}
        {section === 'achievements' && <AchievementsSection />}
        {section === 'avatars' && <AvatarsSection />}
        {section === 'legal' && <LegalSection />}
        {section === 'constants' && <ConstantsSection />}
      </div>
    </div>
  );
};
