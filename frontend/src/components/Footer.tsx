// src/components/Footer.tsx
import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

type ModalType = 'mentions' | 'confidentialite' | 'contact' | null;

const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    // Créer le lien mailto
    const subject = encodeURIComponent(`[Onskone] Message de ${contactForm.name}`);
    const body = encodeURIComponent(
      `Nom: ${contactForm.name}\nEmail: ${contactForm.email}\n\nMessage:\n${contactForm.message}`
    );

    window.location.href = `mailto:simeondeiva@gmail.com?subject=${subject}&body=${body}`;

    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setActiveModal(null);
      setContactForm({ name: '', email: '', message: '' });
    }, 2000);
  };

  const closeModal = () => setActiveModal(null);

  return (
    <>
      <footer className="w-full py-5 text-center text-white/60 text-xs select-none">
        <div className="mb-2">
          Onskone &copy; {new Date().getFullYear()}
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setActiveModal('mentions')}
            className="hover:text-white transition-colors underline"
          >
            Mentions legales
          </button>
          <span>|</span>
          <button
            onClick={() => setActiveModal('confidentialite')}
            className="hover:text-white transition-colors underline"
          >
            Confidentialite
          </button>
          <span>|</span>
          <button
            onClick={() => setActiveModal('contact')}
            className="hover:text-white transition-colors underline"
          >
            Nous contacter
          </button>
        </div>
      </footer>

      {/* Modal Mentions Legales */}
      <Modal
        isOpen={activeModal === 'mentions'}
        onClose={closeModal}
        title="Mentions Legales"
      >
        <div className="text-gray-700 space-y-4">
          <section>
            <h3 className="font-bold text-lg mb-2">Editeur du site</h3>
            <p>
              Le site Onskone est un projet personnel de divertissement.
            </p>
            <p className="mt-2">
              <strong>Responsable de la publication :</strong> Simeon Deiva<br />
              <strong>Contact :</strong> simeondeiva@gmail.com
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Hebergement</h3>
            <p>
              Ce site est heberge par des services d'hebergement web standards.
              Les informations concernant l'hebergeur peuvent etre obtenues sur demande.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Propriete intellectuelle</h3>
            <p>
              L'ensemble des contenus (textes, images, graphismes, logo, icones, etc.)
              figurant sur le site Onskone sont proteges par les lois relatives a la
              propriete intellectuelle et appartiennent a l'editeur ou font l'objet
              d'une autorisation d'utilisation.
            </p>
            <p className="mt-2">
              Toute reproduction, representation, modification, publication ou adaptation
              de tout ou partie des elements du site est interdite sans autorisation
              prealable ecrite.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Limitation de responsabilite</h3>
            <p>
              Onskone ne pourra etre tenu responsable des dommages directs ou indirects
              causes au materiel de l'utilisateur lors de l'acces au site. L'utilisateur
              s'engage a acceder au site en utilisant un materiel recent, ne contenant
              pas de virus et avec un navigateur mis a jour.
            </p>
          </section>
        </div>
      </Modal>

      {/* Modal Confidentialite */}
      <Modal
        isOpen={activeModal === 'confidentialite'}
        onClose={closeModal}
        title="Politique de Confidentialite"
      >
        <div className="text-gray-700 space-y-4">
          <section>
            <h3 className="font-bold text-lg mb-2">Collecte des donnees</h3>
            <p>
              Onskone collecte uniquement les donnees strictement necessaires au
              fonctionnement du jeu :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Votre pseudo (choisi librement, non lie a votre identite)</li>
              <li>Vos reponses aux questions durant les parties</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Utilisation des donnees</h3>
            <p>
              Les donnees collectees sont utilisees exclusivement pour :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Permettre le deroulement des parties de jeu</li>
              <li>Afficher les scores et resultats</li>
              <li>Ameliorer l'experience utilisateur</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Conservation des donnees</h3>
            <p>
              Les donnees de jeu (pseudos, reponses) sont temporaires et ne sont
              pas conservees apres la fin de la session de jeu. Aucune donnee
              personnelle n'est stockee de maniere permanente sur nos serveurs.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Cookies</h3>
            <p>
              Le site peut utiliser des cookies techniques necessaires au bon
              fonctionnement du service (gestion de session, preferences).
              Ces cookies ne collectent aucune donnee personnelle a des fins
              publicitaires.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Vos droits</h3>
            <p>
              Conformement a la reglementation en vigueur, vous disposez d'un
              droit d'acces, de rectification et de suppression de vos donnees.
              Pour exercer ces droits, contactez-nous a : simeondeiva@gmail.com
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg mb-2">Partage des donnees</h3>
            <p>
              Onskone ne vend, n'echange ni ne loue vos informations personnelles
              a des tiers. Vos donnees ne sont jamais partagees a des fins commerciales.
            </p>
          </section>
        </div>
      </Modal>

      {/* Modal Contact */}
      <Modal
        isOpen={activeModal === 'contact'}
        onClose={closeModal}
        title="Nous contacter"
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
              <p className="mb-4">
                Une question, une suggestion ou un probleme ? N'hesitez pas a nous
                contacter en remplissant le formulaire ci-dessous.
              </p>

              <form onSubmit={handleContactSubmit} className="space-y-4">
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
                    placeholder="Decrivez votre question ou suggestion..."
                  />
                </div>

                <div className="text-center pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={sending}
                  >
                    Envoyer le message
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default Footer;
