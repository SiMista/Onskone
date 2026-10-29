import { AVATARS, getAvatarUrl } from '../../../constants/game';
import { SectionHeader } from './SectionHeader';
import { PANEL } from '../ui';

export const AvatarsSection = () => (
  <div>
    <SectionHeader title="Avatars" />
    <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
      Les images que les joueurs peuvent choisir comme avatar avant d'entrer dans un salon.
    </p>
    <div className="grid grid-cols-4 md:grid-cols-7 gap-2.5">
      {AVATARS.map((a) => (
        <div
          key={a.id}
          className={`${PANEL} overflow-hidden`}
        >
          <div className="aspect-square bg-black/30 flex items-center justify-center">
            <img
              src={getAvatarUrl(a.id)}
              alt={`Avatar ${a.id + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="px-2 py-1.5 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[12px] text-white/65">Avatar {a.id + 1}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);
