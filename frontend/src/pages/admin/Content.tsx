import { ContentSection, CONTENT_SECTIONS } from './content/shared';
import { Tabs } from './ui';
import { TiersSection } from './content/TiersSection';
import { DrawingIdeasSection } from './content/DrawingIdeasSection';
import { AchievementsSection } from './content/AchievementsSection';
import { AvatarsSection } from './content/AvatarsSection';
import { LegalSection } from './content/LegalSection';
import { ConstantsSection } from './content/ConstantsSection';

/** Section dans l'URL (/admin/content/<section>) ; absente ou inconnue : la première. */
export const ContentPanel = ({ section: requested, onSectionChange }: {
  section: ContentSection | null;
  onSectionChange: (section: ContentSection) => void;
}) => {
  const section: ContentSection = CONTENT_SECTIONS.some((s) => s.id === requested) ? requested! : CONTENT_SECTIONS[0].id;

  return (
    <div className="space-y-5">
      <Tabs
        value={section}
        onChange={onSectionChange}
        ariaLabel="Sections du contenu"
        tabs={CONTENT_SECTIONS.map((s) => ({ value: s.id, label: s.label, title: s.hint }))}
      />

      <div>
        {section === 'tiers' && <TiersSection />}
        {section === 'drawingIdeas' && <DrawingIdeasSection />}
        {section === 'achievements' && <AchievementsSection />}
        {section === 'avatars' && <AvatarsSection />}
        {section === 'legal' && <LegalSection />}
        {section === 'constants' && <ConstantsSection />}
      </div>
    </div>
  );
};
