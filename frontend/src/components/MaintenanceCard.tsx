import { STICKER_FILTER_STRONG } from '../constants/icons';

// Visuel pur de l'écran de maintenance, sans logique ni positionnement plein écran.
// Pas de bouton : l'écran se lève tout seul (diffusion serveur / reconnexion socket).
interface MaintenanceCardProps {
  title: string;
  message: string;
  note?: string;
}

export const MaintenanceCard = ({ title, message, note }: MaintenanceCardProps) => (
  <div className="w-full max-w-sm bg-cream-paper card-paper rounded-3xl stack-shadow-lg px-6 py-8 flex flex-col items-center text-center gap-4">
    <div className="text-6xl animate-phone-update" style={{ filter: STICKER_FILTER_STRONG }}>🛠️</div>
    <h2 className="font-display font-bold text-display-lg text-gray-900">{title}</h2>
    <p className="font-sans text-sm text-gray-700 leading-snug">{message}</p>
    {note && <p className="font-sans text-xs text-gray-500 leading-snug">{note}</p>}
  </div>
);
