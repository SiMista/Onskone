import { STICKER_FILTER_STRONG } from '../constants/icons';
import Button from './Button';

// Visuel pur de l'écran "Mise à jour requise", sans logique de store ni
// positionnement plein écran. Partagé par UpdateRequiredModal (overlay réel) et
// la galerie Studio (aperçu contenu).
interface UpdateRequiredCardProps {
  title: string;
  message: string;
  ctaLabel: string;
  onAction: () => void;
}

export const UpdateRequiredCard = ({ title, message, ctaLabel, onAction }: UpdateRequiredCardProps) => (
  <div className="w-full max-w-sm bg-cream-paper border-[2.5px] border-black rounded-3xl stack-shadow-lg texture-paper px-6 py-8 flex flex-col items-center text-center gap-4">
    <div className="text-6xl animate-phone-update" style={{ filter: STICKER_FILTER_STRONG }}>📲</div>
    <h2 className="font-display font-bold text-display-lg text-gray-900">{title}</h2>
    <p className="font-sans text-sm text-gray-700 leading-snug">{message}</p>
    <Button variant="success" size="lg" onClick={onAction} className="mt-2 w-full">
      {ctaLabel}
    </Button>
  </div>
);
