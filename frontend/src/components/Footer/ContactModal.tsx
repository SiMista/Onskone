import { useState, useEffect } from 'react';
import Modal from '../Modal';
import Button from '../Button';
import { LEGAL_CONTENT } from '../../constants/legal';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContactForm {
  name: string;
  email: string;
  message: string;
}

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'contact@onskone.com';

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [contactForm, setContactForm] = useState<ContactForm>({
    name: '',
    email: '',
    message: ''
  });
  const [sent, setSent] = useState(false);

  // Cleanup timeout on unmount or when sent changes
  useEffect(() => {
    if (!sent) return;

    const timer = setTimeout(() => {
      setSent(false);
      onClose();
      setContactForm({ name: '', email: '', message: '' });
    }, 2000);

    return () => clearTimeout(timer);
  }, [sent, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSent(false);
      setContactForm({ name: '', email: '', message: '' });
    }
  }, [isOpen]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(contactForm.email)) {
      alert('Veuillez entrer une adresse email valide.');
      return;
    }

    const subject = encodeURIComponent(`[Onskone] Message de ${contactForm.name}`);
    const body = encodeURIComponent(
      `Nom: ${contactForm.name}\nEmail: ${contactForm.email}\n\nMessage:\n${contactForm.message}`
    );

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={LEGAL_CONTENT.contact.title}
    >
      <div className="text-gray-700">
        {sent ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">&#10004;</div>
            <p className="text-green-600 font-bold text-lg">
              Votre client mail va s'ouvrir !
            </p>
            <p className="text-gray-500 mt-2">
              Envoyez le mail pour nous contacter.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4">{LEGAL_CONTENT.contact.description}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre nom
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-primary outline-none transition-colors"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre adresse email
                </label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-primary outline-none transition-colors"
                  placeholder="jean.dupont@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre message
                </label>
                <textarea
                  required
                  rows={5}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-primary outline-none transition-colors resize-none"
                  placeholder="Décrivez votre question ou suggestion..."
                />
              </div>

              <div className="text-center pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                >
                  Envoyer le message
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ContactModal;
