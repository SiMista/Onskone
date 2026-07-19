import { LuDownload, LuX } from 'react-icons/lu';
import { useLocale } from '../i18n';
import { openStore } from '../utils/storeLinks';
import { useAppBannerVisible, hideAppBanner } from '../utils/appBanner';

// Bandeau "télécharge l'app" : WEB uniquement (jamais dans l'app native).
// Overlay en haut de l'écran (ne décale pas le contenu). Fermable, MAIS sans
// mémoire : réaffiché à chaque visite/refresh (on veut qu'il revienne).
// Visibilité partagée (utils/appBanner) pour que la Home décale ses boutons du haut.

const AppDownloadBanner = () => {
  const { t } = useLocale();
  const visible = useAppBannerVisible();

  if (!visible) return null;

  return (
    // Overlay : absolute par-dessus la page (ne pousse rien). pointer-events-none
    // sur la zone pour laisser cliquer autour ; l'étiquette elle-même réactive les events.
    <div
      className="absolute top-0 inset-x-0 z-40 flex justify-center px-3 pointer-events-none"
      style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.25rem))' }}
    >
      {/* Étiquette kraft "scotchée" - carte papier de la DA Onskoné, légèrement de travers */}
      <div className="relative w-full max-w-sm pointer-events-auto">
        {/* Ruban de scotch (washi tape) qui colle l'étiquette */}
        <span
          aria-hidden
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-brand-400/80 border-2 border-black/70 rotate-[-3deg] z-10 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 3px, transparent 3px 8px)',
            boxShadow: '1px 1px 0 0 rgba(0,0,0,0.2)',
          }}
        />

        <div className="relative flex items-center gap-2.5 rounded-2xl card-paper bg-cream-kraft stack-shadow-sm rotate-[-0.6deg] pl-2.5 pr-2 py-1.5">
          {/* Icône de l'app, façon vignette collée */}
          <img
            src="/logo192.png"
            alt=""
            aria-hidden
            className="shrink-0 w-9 h-9 rounded-[10px] border-2 border-black object-cover rotate-[1.5deg]"
          />

          <div className="flex-1 min-w-0 leading-tight">
            <div className="font-display font-extrabold text-sm text-black truncate">
              {t.appBanner.message}
            </div>
            <div className="font-sans font-semibold text-[11px] text-black/55 truncate">
              {t.appBanner.tagline}
            </div>
          </div>

          <button
            type="button"
            onClick={() => openStore()}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-success-500 border-[2.5px] border-black font-display font-bold text-xs text-black active:scale-95 transition-all cursor-pointer stack-shadow-sm"
          >
            <LuDownload size={15} strokeWidth={2.75} />
            {t.appBanner.cta}
          </button>

          <button
            type="button"
            onClick={hideAppBanner}
            aria-label={t.appBanner.close}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-black/40 hover:text-black hover:bg-black/10 active:scale-90 transition-all cursor-pointer"
          >
            <LuX size={15} strokeWidth={2.75} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppDownloadBanner;
