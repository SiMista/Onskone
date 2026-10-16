import type { IconType } from 'react-icons';
import { LuVolume2, LuVolumeX, LuVibrate, LuVibrateOff, LuTriangleAlert, LuShieldCheck } from 'react-icons/lu';
import ModalShell from './ModalShell';
import Dropdown from './Dropdown';
import { CopyableLobbyCode } from './LobbyCode';
import { useSettings } from '../hooks/useSettings';
import { updateSettings } from '../utils/settings';
import { canVibrate, hapticAssigned } from '../utils/haptics';
import { useAdPrivacyOptions, openAdPrivacyOptions } from '../utils/ads';
import { useLocale, LOCALE_META, SUPPORTED_LOCALES } from '../i18n';
import type { Locale } from '@onskone/shared';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "Signaler un problème" : le parent ferme les Réglages et ouvre le formulaire. */
  onReport: () => void;
  /**
   * Langue des questions du salon en cours (lobby / partie). Figée par l'hôte à la
   * création : si le joueur passe l'interface dans une autre langue, on le prévient
   * que les questions, elles, ne changent pas.
   */
  contentLocale?: Locale;
  /**
   * Code du salon de la partie en cours : affiché pour qu'un joueur puisse le
   * redonner à un ami dont l'appli a planté (il reprend sa place avec ce code), et
   * copiable au tap (`onCopyCode`, cf. useShareInvite). Absent à l'accueil et en
   * lobby, qui a déjà son propre bouton d'invitation.
   */
  lobbyCode?: string;
  onCopyCode?: () => void;
}

interface ToggleTileProps {
  on: boolean;
  onToggle: () => void;
  label: string;
  stateLabel: string;
  IconOn: IconType;
  IconOff: IconType;
  /** Réglage sans effet sur cet appareil : tuile grisée, non cliquable. */
  disabled?: boolean;
}

/**
 * Tuile interrupteur : l'icône est barrée quand le réglage est coupé, et un libellé
 * d'état (Activé / Coupé) double l'icône pour ne pas reposer sur le visuel seul.
 */
const ToggleTile = ({ on, onToggle, label, stateLabel, IconOn, IconOff, disabled = false }: ToggleTileProps) => {
  const IconCurrent = on ? IconOn : IconOff;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onToggle}
      className={`w-36 flex flex-col items-center gap-1.5 px-3 py-4 rounded-2xl border-[2.5px] border-black stack-shadow-sm transition-all duration-200 ${
        on ? 'bg-warning-100' : 'bg-cream-settings'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-[1px] active:[box-shadow:none!important]'}`}
    >
      <IconCurrent
        aria-hidden
        size={40}
        strokeWidth={2.25}
        className={`transition-colors duration-200 ${on ? 'text-black' : 'text-black/35'}`}
      />
      <span className="font-display text-sm font-bold uppercase tracking-tight text-black leading-none mt-1">
        {label}
      </span>
      <span className={`text-display-xs leading-none ${on ? 'text-black/60' : 'text-black/40'}`}>
        {stateLabel}
      </span>
    </button>
  );
};

/**
 * Modale Réglages (roue crantée) : son et vibrations, langue de l'interface (propres
 * à l'appareil et appliqués tout de suite), en partie le code du salon (copiable),
 * puis "Signaler un problème" en bas. La tuile Vibrations reste visible mais grisée
 * ("Indisponible") quand l'appareil ne sait pas vibrer (Safari iOS, Firefox
 * desktop) : la masquer laissait croire qu'elle manquait.
 */
const SettingsModal = ({ isOpen, onClose, onReport, contentLocale, lobbyCode, onCopyCode }: SettingsModalProps) => {
  const { t, locale, setLocale } = useLocale();
  const { sound, vibration } = useSettings();
  const showLobby = !!lobbyCode && !!onCopyCode;
  // RGPD : retirer son accord pub doit être aussi simple que le donner. Seulement
  // quand Google l'exige (joueur européen non premium, cf. ads.ts).
  const showAdChoices = useAdPrivacyOptions();

  return (
    // Avec la section Salon la modale s'allonge : on laisse le body scroller sur les
    // petits écrans plutôt que de déborder (sans elle, tout tient sans scroll).
    <ModalShell isOpen={isOpen} onClose={onClose} title={t.settings.title} maxWidth="md" scrollable={showLobby}>
      <div className="flex justify-center gap-3">
        <ToggleTile
          on={sound}
          onToggle={() => updateSettings({ sound: !sound })}
          label={t.settings.sound}
          stateLabel={sound ? t.settings.on : t.settings.off}
          IconOn={LuVolume2}
          IconOff={LuVolumeX}
        />
        <ToggleTile
          on={canVibrate && vibration}
          onToggle={() => {
            updateSettings({ vibration: !vibration });
            // À l'activation : la vibration "réponse reçue" de la partie, pour que
            // l'aperçu corresponde à ce que le joueur sentira en jeu.
            if (!vibration) hapticAssigned();
          }}
          label={t.settings.vibration}
          stateLabel={!canVibrate ? t.settings.unavailable : vibration ? t.settings.on : t.settings.off}
          IconOn={LuVibrate}
          IconOff={LuVibrateOff}
          disabled={!canVibrate}
        />
      </div>

      {/* Langue de l'interface : même largeur que la rangée de tuiles au-dessus.
          Nom de chaque langue écrit dans la langue de l'interface (+ drapeau). */}
      <section className="w-full max-w-[18.75rem] mx-auto mt-5 flex flex-col gap-2">
        <h3 className="m-0 px-1 text-display-xs text-black/55">{t.common.language}</h3>
        <Dropdown<Locale>
          value={locale}
          onChange={(code) => { if (code !== locale) setLocale(code); }}
          options={SUPPORTED_LOCALES.map((code) => ({
            value: code,
            label: t.settings.languageNames[code],
            prefix: <span aria-hidden className="text-lg leading-none">{LOCALE_META[code].flag}</span>,
          }))}
        />
        {contentLocale && contentLocale !== locale && (
          <p className="m-0 px-1 font-sans text-[11px] text-gray-600 leading-snug">
            {t.settings.contentLocaleHint}
          </p>
        )}
      </section>

      {/* Salon (partie en cours) : le code, lisible pour le redonner de vive voix et
          copiable au tap. Même bloc que la feuille d'invitation (CopyableLobbyCode). */}
      {showLobby && (
        <section className="w-full max-w-[18.75rem] mx-auto mt-5 flex flex-col gap-2">
          <h3 className="m-0 px-1 text-display-xs text-black/55">{t.settings.lobby}</h3>
          <CopyableLobbyCode
            value={lobbyCode}
            onCopy={onCopyCode}
            ariaLabel={t.lobby.shareInvite.codeLabel}
            className="w-full"
          />
          <p className="m-0 px-1 font-sans text-[11px] text-gray-600 leading-snug">
            {t.settings.inviteHint}
          </p>
        </section>
      )}

      <span aria-hidden className="block w-full mt-5 border-t-[1.5px] border-dashed border-black/15" />

      {/* Actions à part, sous les réglages : choix publicitaires (si requis) et
          signaler un problème, en rouge. */}
      <div className="flex flex-wrap justify-center gap-x-2 pt-3 pb-1">
        {showAdChoices && (
          <button
            type="button"
            onClick={() => { void openAdPrivacyOptions(); }}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 font-display text-sm font-bold uppercase tracking-tight text-black/60 hover:text-black transition-colors cursor-pointer"
          >
            <LuShieldCheck aria-hidden size={16} strokeWidth={2.5} />
            {t.settings.adChoices}
          </button>
        )}
        <button
          type="button"
          onClick={onReport}
          className="inline-flex items-center gap-1.5 min-h-11 px-3 font-display text-sm font-bold uppercase tracking-tight text-danger-700 hover:text-danger-500 transition-colors cursor-pointer"
        >
          <LuTriangleAlert aria-hidden size={16} strokeWidth={2.5} />
          {t.settings.report}
        </button>
      </div>
    </ModalShell>
  );
};

export default SettingsModal;
