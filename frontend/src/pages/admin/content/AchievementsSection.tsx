import { Icon } from '@iconify/react';
import { ACHIEVEMENTS } from '../../../utils/playerStats';
import { SectionHeader } from './SectionHeader';
import { ACHIEVEMENT_TEXTS } from './shared';

export const AchievementsSection = () => (
  <div>
    <SectionHeader title="Succès" count={ACHIEVEMENTS.length} />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Badges débloqués par le joueur en fin de partie, sauvegardés sur son appareil.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {ACHIEVEMENTS.map((a) => {
        const meta = ACHIEVEMENT_TEXTS[a.id];
        return (
        <div
          key={a.id}
          className="rounded-lg surface-glass p-3 flex items-start gap-3"
        >
          <Icon icon={a.icon} className="w-9 h-9 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white truncate">{meta?.title ?? a.id}</p>
            <p className="text-[12.5px] text-white/65 leading-snug mt-0.5">
              {meta?.description ?? ''}
            </p>
          </div>
        </div>
        );
      })}
    </div>
  </div>
);
