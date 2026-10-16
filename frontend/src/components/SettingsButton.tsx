import { useState } from 'react';
import { LuSettings } from 'react-icons/lu';
import SettingsModal from './SettingsModal';
import ReportModal from './ReportModal';
import InfoModal from './InfoModal';
import { useShareInvite } from '../hooks/useShareInvite';
import { useLocale } from '../i18n';
import type { Locale } from '@onskone/shared';

/**
 * Roue crantée des Réglages, posée sur tous les écrans de jeu (accueil, lobby,
 * partie ; pas l'écran de fin). Volontairement discrète, même traitement que
 * "Comment jouer ?" / "Retour" : icône blanche translucide, pastille au survol.
 * Porte aussi la modale de signalement : "Signaler un problème" ferme les
 * Réglages puis ouvre le formulaire, plutôt que d'empiler deux modales.
 */
interface SettingsButtonProps {
  /** Langue des questions du salon en cours (lobby / partie), cf. SettingsModal. */
  contentLocale?: Locale;
  /**
   * Partie en cours : la modale affiche le code du salon, copiable (un joueur qui a
   * perdu sa session reprend sa place avec le code). Pas en lobby (qui a déjà son
   * bouton d'invitation) ni à l'accueil.
   */
  lobbyCode?: string;
}

const SettingsButton = ({ contentLocale, lobbyCode }: SettingsButtonProps) => {
  const { t } = useLocale();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  // Même copie du code que la feuille d'invitation du lobby (avec son repli).
  const { copyCode, fallbackLink, clearFallbackLink } = useShareInvite(lobbyCode, t);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        aria-haspopup="dialog"
        aria-label={t.settings.button}
        title={t.settings.button}
        className="group shrink-0 flex items-center justify-center p-2.5 rounded-full border-[1.5px] border-transparent text-white/75 cursor-pointer transition-all duration-200 ease-out hover:bg-white/15 hover:border-white/40 hover:text-white active:translate-y-0.5"
      >
        <LuSettings
          aria-hidden
          size={20}
          strokeWidth={2.5}
          className="transition-transform duration-300 ease-out group-hover:rotate-90 motion-reduce:transition-none"
        />
      </button>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        contentLocale={contentLocale}
        lobbyCode={lobbyCode}
        onCopyCode={lobbyCode ? copyCode : undefined}
        onReport={() => {
          setIsSettingsOpen(false);
          setIsReportOpen(true);
        }}
      />
      {isReportOpen && (
        <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
      )}

      {/* Repli : affiche le code quand toutes les méthodes de copie ont échoué
          (même modale que le lobby). */}
      {lobbyCode && (
        <InfoModal
          isOpen={fallbackLink !== null}
          onClose={clearFallbackLink}
          title={t.lobby.modals.copyLink.title}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700 m-0">
              {t.lobby.modals.copyLink.body}
            </p>
            <input
              type="text"
              readOnly
              value={fallbackLink ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t.lobby.modals.copyLink.title}
              className="w-full text-sm font-mono text-gray-900 bg-cream-player border-[2.5px] border-black rounded-lg px-3 py-2 outline-none stack-shadow-sm"
            />
          </div>
        </InfoModal>
      )}
    </>
  );
};

export default SettingsButton;
