import { useState } from 'react';
import AboutModal from './AboutModal';
import ContactModal from './ContactModal';
import MentionsModal from './MentionsModal';
import ReportTrigger from '../ReportTrigger';
import { useLocale } from '../../i18n';

type ModalType = 'about' | 'mentions' | 'contact' | null;

// pointer-events-auto : seuls les liens captent le clic. Le <footer> reste
// pointer-events-none pour que ses zones vides (padding, bande pleine largeur)
// laissent passer les taps vers le contenu dessous (ex: bouton sous l'overlay).
const footerLinkClass = 'pointer-events-auto hover:text-white transition-colors underline cursor-pointer';

const Footer = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const { t } = useLocale();

  const closeModal = () => setActiveModal(null);

  return (
    <>
      <footer
        className="w-full py-5 text-center text-white/60 text-[10px] md:text-xs select-none pointer-events-none"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-2">
          <span className="pointer-events-auto inline-block">
            <ReportTrigger variant="footer" label={t.report.footerLabel} />
          </span>
        </div>
        <div className="flex justify-center items-center gap-3 md:gap-5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setActiveModal('about')}
            className={footerLinkClass}
          >
            {t.footer.about}
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setActiveModal('mentions')}
            className={footerLinkClass}
          >
            {t.footer.mentions}
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setActiveModal('contact')}
            className={footerLinkClass}
          >
            {t.footer.contact}
          </button>
          <span aria-hidden="true">|</span>
          <a
            href="https://www.youtube.com/watch?v=xvFZjo5PgG0&list=RDxvFZjo5PgG0&start_radio=1"
            target="_blank"
            rel="noopener noreferrer"
            className={footerLinkClass}
          >
            {t.footer.dontClick}
          </a>
        </div>
      </footer>

      {/* Modals - rendered conditionally for performance */}
      {activeModal === 'about' && (
        <AboutModal isOpen onClose={closeModal} />
      )}
      {activeModal === 'mentions' && (
        <MentionsModal isOpen onClose={closeModal} />
      )}
      {activeModal === 'contact' && (
        <ContactModal isOpen onClose={closeModal} />
      )}
    </>
  );
};

export default Footer;
