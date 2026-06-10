import { useEffect, useState } from 'react';
import { GameMode } from '@onskone/shared';
import type { Locale } from '@onskone/shared';
import InfoModal from './InfoModal';
import EmojiCard from './EmojiCard';
import { useLocale, LOCALE_META, SUPPORTED_LOCALES } from '../i18n';
import type { Dictionary } from '../i18n/dictionary';

interface GameModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: GameMode, deckLocale: Locale) => void;
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
  const { locale: uiLocale, t } = useLocale();
  const [deckLocale, setDeckLocale] = useState<Locale>(uiLocale);

  // Quand on rouvre la modale, on resync sur la langue UI courante (défaut sensé)
  useEffect(() => {
    if (isOpen) setDeckLocale(uiLocale);
  }, [isOpen, uiLocale]);

  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title={t.modes.title} disableScrollFade>
      <div className="flex flex-col gap-3 pb-4">
        <fieldset className="flex flex-col gap-1.5 pb-1">
          <legend className="text-display-xs text-gray-600 px-1">{t.modes.questionLanguage}</legend>
          <div className="flex gap-1.5 flex-wrap">
            {SUPPORTED_LOCALES.map((code) => {
              const meta = LOCALE_META[code];
              const active = code === deckLocale;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setDeckLocale(code)}
                  aria-pressed={active}
                  aria-label={meta.label}
                  title={meta.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border-2 border-black font-display font-semibold text-sm transition-transform ${
                    active ? 'bg-brand-200 stack-shadow-sm scale-[1.02]' : 'bg-cream-paper hover:scale-105'
                  }`}
                >
                  <span aria-hidden className="text-base leading-none">{meta.flag}</span>
                  <span>{meta.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {MODES.map((opt) => {
          const text = modeText(opt.mode, t.modes);
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => onSelect(opt.mode, deckLocale)}
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
