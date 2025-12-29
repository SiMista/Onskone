import { useState, useMemo } from 'react';
import AboutModal from './AboutModal';
import ContactModal from './ContactModal';
import LegalModal from './LegalModal';
import PrivacyModal from './PrivacyModal';

type ModalType = 'about' | 'mentions' | 'confidentialite' | 'contact' | null;

const footerLinkClass = 'hover:text-white transition-colors underline cursor-pointer';

const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const closeModal = () => setActiveModal(null);

  return (
    <>
      <footer className="w-full py-5 text-center text-white/60 text-xs select-none">
        <div className="mb-2">
          Onskone &copy; {currentYear}
        </div>
        <div className="flex justify-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveModal('about')}
            className={footerLinkClass}
          >
            À propos
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setActiveModal('mentions')}
            className={footerLinkClass}
          >
            Mentions légales
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setActiveModal('confidentialite')}
            className={footerLinkClass}
          >
            Confidentialité
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setActiveModal('contact')}
            className={footerLinkClass}
          >
            Nous contacter
          </button>
          <span aria-hidden="true">|</span>
          <a
            href="https://www.youtube.com/watch?v=xvFZjo5PgG0&list=RDxvFZjo5PgG0&start_radio=1"
            target="_blank"
            rel="noopener noreferrer"
            className={footerLinkClass}
          >
            Ne clique pas
          </a>
        </div>
      </footer>

      {/* Modals - rendered conditionally for performance */}
      {activeModal === 'about' && (
        <AboutModal isOpen onClose={closeModal} />
      )}
      {activeModal === 'mentions' && (
        <LegalModal isOpen onClose={closeModal} />
      )}
      {activeModal === 'confidentialite' && (
        <PrivacyModal isOpen onClose={closeModal} />
      )}
      {activeModal === 'contact' && (
        <ContactModal isOpen onClose={closeModal} />
      )}
    </>
  );
};

export default Footer;
