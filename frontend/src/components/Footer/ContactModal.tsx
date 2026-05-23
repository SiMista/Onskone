import { Icon } from '@iconify/react';
import Modal from '../Modal';
import { LEGAL_CONTENT } from '../../constants/legal';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'onskonelejeu@gmail.com';

interface Channel {
  href: string;
  label: string;
  handle: string;
  icon: string;
  /** Classes Tailwind pour fond + couleur de texte de la tuile. */
  tileClass: string;
  /** Couleur du handle (sous-titre) - ajustée par tuile pour rester lisible. */
  handleClass: string;
  /** Couleur de la flèche au repos. */
  arrowClass: string;
}

/** Logos officiels (Iconify "logos:" / "skill-icons:") déjà colorés selon la marque,
 *  posés dans une pastille blanche pour rester visibles sur fond coloré. */
const CHANNELS: Channel[] = [
  {
    href: 'https://www.instagram.com/onskone',
    label: 'Instagram',
    handle: '@onskone',
    icon: 'skill-icons:instagram',
    tileClass:
      'bg-gradient-to-br from-[#DD2A7B] via-[#F58529] to-[#FEDA77] text-white',
    handleClass: 'text-white/85',
    arrowClass: 'text-white/80',
  },
  {
    href: 'https://www.tiktok.com/@onskonelejeu',
    label: 'TikTok',
    handle: '@onskonelejeu',
    icon: 'logos:tiktok-icon',
    // Fond blanc cassé avec touches très légères des couleurs TikTok (cyan en haut-gauche,
    // rose en bas-droite) - même grammaire que le gradient Instagram mais en sous-exposé.
    tileClass:
      'bg-gradient-to-br from-[#CFFAFE] via-[#FAF9F6] to-[#FCE7F3] text-gray-900',
    handleClass: 'text-gray-600',
    arrowClass: 'text-gray-500',
  },
  {
    href: `mailto:${CONTACT_EMAIL}`,
    label: 'Email',
    handle: CONTACT_EMAIL,
    icon: 'fluent-emoji-flat:envelope-with-arrow',
    tileClass:
      'bg-gradient-to-br from-[#60A5FA] via-[#3B82F6] to-[#1E40AF] text-white',
    handleClass: 'text-white/85',
    arrowClass: 'text-white/85',
  },
];

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={LEGAL_CONTENT.contact.title}
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-gray-700 text-sm leading-relaxed m-0">
          Tu veux nous contacter mais tu sais pas comment ? T'inquiète, écris-nous où tu veux, ce sera un plaisir de te répondre :
        </p>
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {CHANNELS.map((c) => {
            const isExternal = c.href.startsWith('http');
            return (
              <li key={c.label}>
                <a
                  href={c.href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  className={`group flex items-center gap-3.5 px-4 py-3 border-[2.5px] border-black rounded-2xl stack-shadow-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] no-underline ${c.tileClass}`}
                >
                  {/* Logo sans pastille : taille augmentée + halo lumineux blanc derrière
                      + contour fin (blanc sur tuiles sombres/colorées) pour qu'il décolle. */}
                  <span
                    aria-hidden
                    className="relative shrink-0 w-12 h-12 flex items-center justify-center"
                  >
                    {/* Halo radial blanc diffus posé sous le logo - donne du contraste
                        local sans encombrer la tuile avec une forme dure. */}
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 65%)',
                      }}
                    />
                    <Icon
                      icon={c.icon}
                      width={40}
                      height={40}
                      className="relative"
                      style={{
                        // Contour noir 4 directions (technique drop-shadow empilée) sur tous
                        // les logos pour les détacher de leur tuile colorée, + halo lumineux
                        // adapté au fond (blanc sur TikTok noir, gris foncé sinon).
                        // Ombre noire douce pour décoller le logo de la tuile.
                        filter:
                          c.icon.startsWith('fluent-emoji')
                            ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))'
                            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                      }}
                    />
                  </span>

                  <span className="flex flex-col min-w-0 flex-1 text-left">
                    <span className="font-display font-bold text-base leading-tight">
                      {c.label}
                    </span>
                    <span className={`font-sans text-xs truncate ${c.handleClass}`}>
                      {c.handle}
                    </span>
                  </span>

                  <Icon
                    icon="lucide:arrow-up-right"
                    width={20}
                    height={20}
                    aria-hidden
                    className={`shrink-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${c.arrowClass}`}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
};

export default ContactModal;
