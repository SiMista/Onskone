import type { ReclaimablePlayer } from '@onskone/shared';
import ModalShell from './ModalShell';
import Button from './Button';
import Avatar from './Avatar';
import Spinner from './Spinner';
import { useLocale } from '../i18n';

interface ReclaimPlayerModalProps {
  isOpen: boolean;
  players: ReclaimablePlayer[];
  /** Le joueur affirme être ce slot : le parent émet `reclaimPlayer`. */
  onPick: (playerId: string) => void;
  /** « Je ne jouais pas » / fermeture. */
  onDismiss: () => void;
}

/**
 * « Tu étais dans cette partie ? » : liste des joueurs dont la connexion est tombée
 * (cf. lobbyInfo.reclaimablePlayers). Un joueur qui a perdu sa session (crash,
 * appli tuée, stockage vidé) choisit son pseudo et reprend sa place en cours de
 * partie, sans rien d'autre que le code du salon.
 */
const ReclaimPlayerModal = ({ isOpen, players, onPick, onDismiss }: ReclaimPlayerModalProps) => {
  const { t } = useLocale();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onDismiss}
      title={t.home.reclaim.title}
      maxWidth="md"
      // Un retour au premier plan referme les modales : celle-ci doit survivre, le
      // joueur vient justement de revenir dans l'appli.
      keepOnResume
      footer={
        <div className="flex justify-center">
          <Button text={t.home.reclaim.notMe} variant="ghost" size="md" onClick={onDismiss} />
        </div>
      }
    >
      <p className="text-sm text-gray-700 text-center mb-4">{t.home.reclaim.message}</p>
      {players.length === 0 && (
        // Personne de déconnecté pour l'instant : le parent relance la liste
        // (une place se libère ~25 s après la mort d'un socket).
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-3">
          <Spinner className="h-4 w-4" />
          <span>{t.home.reclaim.waiting}</span>
        </div>
      )}
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 border-black bg-cream-player stack-shadow-sm cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Avatar avatarId={p.avatarId} name={p.name} size="md" />
              <span className="font-display font-bold text-gray-900 truncate">{p.name}</span>
              <span className="ml-auto text-display-xs text-gray-500">{t.home.reclaim.pick}</span>
            </button>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
};

export default ReclaimPlayerModal;
