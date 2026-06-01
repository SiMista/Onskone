import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useLocale, LOCALE_META, SUPPORTED_LOCALES } from '../i18n';

const LanguageSwitcher = () => {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  // `render` garde le <ul> monté le temps de l'anim de fermeture ; `closing` choisit l'anim.
  const [render, setRender] = useState(false);
  const [closing, setClosing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Ouvrir = monter + lancer l'anim d'ouverture ; fermer = lancer l'anim de close (démontage à la fin).
  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
    } else if (render) {
      setClosing(true);
    }
  }, [open, render]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = LOCALE_META[locale];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t.common.language} (${current.label})`}
        title={current.label}
        className="flex items-center gap-1 p-1.5 rounded-xl border-2 border-black bg-cream-paper stack-shadow-sm hover:scale-105 active:scale-95 transition-transform"
      >
        <span aria-hidden className="text-lg leading-none">{current.flag}</span>
        <Icon icon="mdi:chevron-down" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {render && (
        <ul
          role="listbox"
          aria-label={t.common.language}
          onAnimationEnd={() => { if (closing) { setRender(false); setClosing(false); } }}
          className={`absolute right-0 mt-1.5 min-w-[10rem] rounded-xl border-2 border-black bg-cream-paper stack-shadow-sm overflow-hidden z-50 ${closing ? 'animate-menu-close' : 'animate-menu-open'}`}
        >
          {SUPPORTED_LOCALES.map(code => {
            const meta = LOCALE_META[code];
            const selected = code === locale;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { setLocale(code); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 font-display text-sm text-left transition-colors ${selected ? 'bg-brand-200' : 'hover:bg-warning-100'}`}
                >
                  <span aria-hidden className="text-base leading-none">{meta.flag}</span>
                  <span className="font-semibold">{meta.label}</span>
                  {selected && <Icon icon="mdi:check" className="ml-auto w-4 h-4" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LanguageSwitcher;
