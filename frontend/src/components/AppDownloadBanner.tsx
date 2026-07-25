import { LuX } from 'react-icons/lu';
import StoreBadge from './StoreBadge';
import { useLocale } from '../i18n';
import { detectMobileOS, APP_STORE_WEB, PLAY_WEB } from '../utils/storeLinks';
import { useAppBannerVisible, hideAppBanner } from '../utils/appBanner';

// Bandeau "télécharge l'app" : WEB uniquement (jamais dans l'app native).
// Overlay en haut de l'écran (ne décale pas le contenu). Fermable, MAIS sans
// mémoire : réaffiché à chaque visite/refresh (on veut qu'il revienne).
// Visibilité partagée (utils/appBanner) pour que la Home décale ses boutons du haut.

const AppDownloadBanner = () => {
  const { t } = useLocale();
  const visible = useAppBannerVisible();

  // Toujours des badges store officiels (jamais un bouton maison) : ils disent
  // "appli" bien plus vite qu'un CTA générique. On affiche celui de l'OS
  // détecté, et les deux sur desktop où le user-agent ne tranche pas.
  // Pas de state : le user-agent ne change pas en cours de session.
  const os = detectMobileOS();

  if (!visible) return null;

  return (
    // Overlay : absolute par-dessus la page (ne pousse rien). pointer-events-none
    // sur la zone pour laisser cliquer autour ; l'étiquette elle-même réactive les events.
    <div
      className="absolute top-0 inset-x-0 z-40 flex justify-center px-3 pointer-events-none"
      style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.25rem))' }}
    >
      {/* Étiquette kraft "scotchée" - carte papier de la DA Onskoné, légèrement de travers.
          Plus large quand on affiche les DEUX badges (desktop) : sinon ils mangent
          la place du titre, qui se tronque. */}
      <div className={`relative w-full pointer-events-auto ${os === 'other' ? 'max-w-lg' : 'max-w-sm'}`}>
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

          {os === 'other' ? (
            // Desktop : on ne peut pas deviner le téléphone de l'user, donc les
            // deux fiches côte à côte (la largeur ne manque pas sur PC).
            <div className="shrink-0 flex items-center gap-1.5">
              <StoreBadge store="apple" href={APP_STORE_WEB} ariaLabel={t.premium.getOnAppStore} className="w-[96px]" />
              <StoreBadge store="google" href={PLAY_WEB} ariaLabel={t.premium.getOnPlayStore} className="w-[108px]" />
            </div>
          ) : os === 'ios' ? (
            <StoreBadge store="apple" href={APP_STORE_WEB} ariaLabel={t.premium.getOnAppStore} className="shrink-0 w-[112px]" />
          ) : (
            <StoreBadge store="google" href={PLAY_WEB} ariaLabel={t.premium.getOnPlayStore} className="shrink-0 w-[112px]" />
          )}

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
