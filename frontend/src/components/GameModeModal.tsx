import { GameMode } from '@onskone/shared';
import InfoModal from './InfoModal';
import EmojiCard from './EmojiCard';
import { useLocale } from '../i18n';
import type { Dictionary } from '../i18n/dictionary';

interface GameModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: GameMode) => void;
}

interface ModeOption {
  mode: GameMode;
  icon: string;
  iconBg: string;
  iconPattern?: string;
}

const MODES: ModeOption[] = [
  {
    mode: 'local',
    icon: 'fluent-emoji-flat:busts-in-silhouette',
    iconBg: 'bg-gradient-to-br from-warning-300 to-warning-orange',
    iconPattern: 'bg-pattern-dots',
  },
  {
    mode: 'remote',
    icon: 'fluent-emoji-flat:globe-showing-europe-africa',
    iconBg: 'bg-gradient-to-br from-brand-200 to-brand-400',
    iconPattern: 'bg-pattern-diagonal',
  },
];

const modeText = (mode: GameMode, modes: Dictionary['modes']) =>
  mode === 'local' ? modes.local : modes.remote;

const GameModeModal = ({ isOpen, onClose, onSelect }: GameModeModalProps) => {
  const { t } = useLocale();

  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title={t.modes.title} disableScrollFade>
      <div className="flex flex-col gap-3 pb-4">
        {MODES.map((opt) => {
          const text = modeText(opt.mode, t.modes);
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => onSelect(opt.mode)}
              className="group flex items-stretch w-full border-[2.5px] border-black rounded-2xl overflow-hidden stack-shadow-sm bg-white hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150 cursor-pointer text-left"
            >
              <EmojiCard icon={opt.icon} bgClassName={opt.iconBg} pattern={opt.iconPattern} />
              <div className="flex-1 min-w-0 px-3.5 py-3 md:px-4 md:py-3.5 flex flex-col justify-center gap-1">
                <div className="font-display font-bold text-display-md text-gray-900 leading-tight">
                  {text.title}
                </div>
                <div className="font-sans text-xs leading-snug text-gray-600">
                  {text.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </InfoModal>
  );
};

export default GameModeModal;
