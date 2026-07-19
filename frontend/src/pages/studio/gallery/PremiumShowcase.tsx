import { useState } from 'react';
import { LuLock, LuCheck } from 'react-icons/lu';
import Button from '../../../components/Button';
import StoreBadge from '../../../components/StoreBadge';
import PremiumModal from '../../../components/PremiumModal';
import { APP_STORE_WEB, PLAY_WEB } from '../../../utils/storeLinks';
import { usePremium, setPremiumOverride } from '../../../utils/premium';
import { fr } from '../../../i18n/fr';
import { Section, Tile } from './layout';

// Vitrine des composants premium (monétisation) - inspecteur DEV isolé.
// Regroupe : badges store officiels, pastille de verrouillage, paywall, et
// le toggle d'override premium (le même que le 👑 de la toolbar).
export const PremiumShowcase = () => {
  const isPremium = usePremium();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const t = fr.premium;

  return (
    <>
      <Section title="Premium - badges store" subtitle="reproduction maison (SVG inline) des badges officiels">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Tile label="App Store">
            <StoreBadge store="apple" href={APP_STORE_WEB} className="w-[160px]" />
          </Tile>
          <Tile label="Google Play">
            <StoreBadge store="google" href={PLAY_WEB} className="w-[160px]" />
          </Tile>
        </div>
      </Section>

      <Section title="Premium - verrouillage & avantages" subtitle="pastille cadenas + puces d'avantages du paywall">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Tile label="Pastille verrouillé (overlay carte thème)">
            <span className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-black/70 text-white border-2 border-white/70">
              <LuLock size={13} strokeWidth={2.75} aria-hidden />
              <span className="text-[11px] font-display font-bold leading-none tracking-wide">{fr.themePicker.premiumBadge}</span>
            </span>
          </Tile>
          <Tile label="Puces d'avantages">
            <ul className="flex flex-col gap-2 m-0 p-0 list-none">
              {[t.perkQuestions, t.perkThemes, t.perkFuture].map((label) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full border-[2.5px] border-black"
                    style={{ background: 'linear-gradient(135deg, #FFE680 0%, #FFB347 100%)' }}
                  >
                    <LuCheck size={14} strokeWidth={3.5} className="text-black" />
                  </span>
                  <span className="font-sans text-sm text-white/85">{label}</span>
                </li>
              ))}
            </ul>
          </Tile>
          <Tile label="Pseudo doré (nom brillant premium)">
            <span className="font-display font-extrabold text-2xl text-gold-shine">{t.perkNameSample || 'Toi'}</span>
          </Tile>
        </div>
      </Section>

      <Section title="Premium - paywall & statut" subtitle="ouvre la modale et bascule le statut premium (comme le 👑 toolbar)">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button text="Ouvrir le paywall" variant="warning" size="sm" onClick={() => setPaywallOpen(true)} />
            <button
              type="button"
              onClick={() => setPremiumOverride(!isPremium)}
              className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                isPremium
                  ? 'bg-amber-400/20 border border-amber-300/60 text-amber-100'
                  : 'bg-white/10 border border-white/20 text-white/70 hover:bg-white/15'
              }`}
            >
              {isPremium ? '👑 premium ACTIF - clic pour couper' : 'premium inactif - clic pour simuler'}
            </button>
          </div>
          <p className="font-mono text-[10px] text-white/30 leading-relaxed">
            Sur le web, le paywall s'affiche en mode "va sur le store" (badges) : l'achat in-app n'existe qu'en natif.
            Le toggle écrit le vrai cache premium (studioStorage) - même effet que le 👑 de la régie.
          </p>
        </div>
      </Section>

      <PremiumModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  );
};
