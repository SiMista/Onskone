import { useState } from 'react';
import { ContentSection, CONTENT_SECTIONS } from './content/shared';
import { Tabs } from './ui';
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
      <Tabs
        value={section}
        onChange={setSection}
        ariaLabel="Sections du contenu"
        tabs={CONTENT_SECTIONS.map((s) => ({ value: s.id, label: s.label, title: s.hint }))}
      />

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
