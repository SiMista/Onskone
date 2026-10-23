import { LuX } from 'react-icons/lu';
import { useLocation } from 'react-router-dom';
import StoreBadge from './StoreBadge';
import { useLocale } from '../i18n';
import { detectMobileOS, APP_STORE_WEB, PLAY_WEB } from '../utils/storeLinks';
import { useAppBanner, hideAppBanner, APP_BANNER_DURATION_MS } from '../utils/appBanner';

// Bandeau "télécharge l'app" : WEB uniquement (jamais dans l'app native).
// Notification temporaire en HAUT de l'écran (overlay : ne décale RIEN). Déclenchée
// par utils/appBanner (lancement web + fin de partie), se retire seule après
// APP_BANNER_DURATION_MS ; la barre en bas du bandeau montre le temps restant.
// Jamais dans le salon / en partie (elle masquerait le jeu). Fermable.

const AppDownloadBanner = () => {
  const { t } = useLocale();
  const { visible, leaving, shownAt } = useAppBanner();
  const { pathname } = useLocation();
  const inGameFlow = /^\/(lobby|game)\//.test(pathname);

  // Toujours des badges store officiels (jamais un bouton maison) : ils disent
  // "appli" bien plus vite qu'un CTA générique. On affiche celui de l'OS
  // détecté, et les deux sur desktop où le user-agent ne tranche pas.
  // Pas de state : le user-agent ne change pas en cours de session.
  const os = detectMobileOS();

  if (!visible || inGameFlow) return null;

  return (
    // Overlay : absolute par-dessus la page (ne pousse rien). pointer-events-none
    // sur la zone pour laisser cliquer autour ; l'étiquette elle-même réactive les events.
    <div
      className="absolute top-0 inset-x-0 z-[60] flex justify-center px-3 pointer-events-none"
      style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.25rem))' }}
    >
      {/* Étiquette kraft "scotchée" - carte papier de la DA Onskoné, légèrement de travers.
          Apparition/sortie en fondu (la sortie garde le bandeau monté, cf. utils/appBanner). */}
      <div
        className={`relative w-full pointer-events-auto ${os === 'other' ? 'max-w-2xl' : 'max-w-sm'} ${leaving ? 'animate-app-banner-out' : 'animate-app-banner-in'}`}
      >
        {/* Ruban de scotch (washi tape) qui colle l'étiquette */}
        <span
          aria-hidden
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-brand-400/80 border-2 border-black/70 rotate-[-3deg] z-10 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 3px, transparent 3px 8px)',
            boxShadow: '1px 1px 0 0 rgba(0,0,0,0.2)',
          }}
        />

        {/* Une seule ligne partout : icône, titre (qui passe sur 2 lignes si besoin), badge store.
            Sur mobile on coupe la tagline pour que le titre ne soit jamais tronqué. */}
        <div className="relative flex items-center gap-2 rounded-2xl card-paper bg-cream-kraft stack-shadow-sm rotate-[-0.6deg] pl-3.5 pr-2.5 pt-3 pb-5">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Icône de l'app, façon vignette collée */}
            <img
              src="/logo192.png"
              alt=""
              aria-hidden
              className="shrink-0 w-11 h-11 tablet:w-12 tablet:h-12 rounded-xl border-2 border-black object-cover rotate-[1.5deg]"
            />
            <div className="flex-1 min-w-0 leading-tight">
              <div className="font-display font-extrabold text-[15px] tablet:text-lg text-black">
                {t.appBanner.message}
              </div>
              <div className="hidden tablet:block font-sans font-semibold text-sm text-black/65">
                {t.appBanner.tagline}
              </div>
            </div>
          </div>

          {os === 'other' ? (
            // Desktop : on ne peut pas deviner le téléphone de l'user, donc les
            // deux fiches côte à côte (la largeur ne manque pas sur PC).
            <div className="shrink-0 flex items-center gap-1.5">
              <StoreBadge store="apple" href={APP_STORE_WEB} ariaLabel={t.premium.getOnAppStore} className="w-[112px]" />
              <StoreBadge store="google" href={PLAY_WEB} ariaLabel={t.premium.getOnPlayStore} className="w-[126px]" />
            </div>
          ) : os === 'ios' ? (
            <StoreBadge store="apple" href={APP_STORE_WEB} ariaLabel={t.premium.getOnAppStore} className="shrink-0 w-[116px] tablet:w-[140px]" />
          ) : (
            <StoreBadge store="google" href={PLAY_WEB} ariaLabel={t.premium.getOnPlayStore} className="shrink-0 w-[116px] tablet:w-[140px]" />
          )}

          <button
            type="button"
            onClick={hideAppBanner}
            aria-label={t.appBanner.close}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-black/40 hover:text-black hover:bg-black/10 active:scale-90 transition-all cursor-pointer"
          >
            <LuX size={15} strokeWidth={2.75} />
          </button>

          {/* Barre de durée : se vide jusqu'au retrait automatique du bandeau. Le délai
              négatif recale l'animation si le bandeau se monte après le déclenchement. */}
          <div aria-hidden className="absolute left-4 right-4 bottom-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div
              key={shownAt}
              className="h-full w-full origin-left rounded-full bg-brand-500 animate-app-banner-drain"
              style={{
                animationDuration: `${APP_BANNER_DURATION_MS}ms`,
                animationDelay: `${-(Date.now() - shownAt)}ms`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppDownloadBanner;
