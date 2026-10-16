import Button from './Button';
import ModalShell from './ModalShell';
import { useLocale } from '../i18n';
import { useAdConsentIntro, continueConsentIntro } from '../utils/ads';

/**
 * Écran d'intro, au style Onskoné, juste avant le formulaire de consentement de
 * Google (cf. ads.ts) : explique pourquoi la popup arrive et qu'on peut refuser.
 * Pas de bouton "Accepter" ici : le choix se fait uniquement dans le formulaire de
 * Google. Fermer revient à continuer. keepOnResume : ads.ts attend ce clic.
 */
const AdConsentIntroModal = () => {
  const { t } = useLocale();
  const isOpen = useAdConsentIntro();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={continueConsentIntro}
      title={t.ads.introTitle}
      maxWidth="md"
      scrollable={false}
      keepOnResume
      footer={
        <div className="flex justify-center">
          <Button text={t.ads.introContinue} variant="primary" size="sm" onClick={continueConsentIntro} />
        </div>
      }
    >
      <p className="text-gray-700 text-center m-0">{t.ads.introBody}</p>
    </ModalShell>
  );
};

export default AdConsentIntroModal;
