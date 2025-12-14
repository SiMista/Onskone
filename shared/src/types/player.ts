/**
 * Joueur dans un lobby ou une partie
 */
export interface IPlayer {
  /** Identifiant unique du joueur (UUID) */
  id: string;

  /** ID du socket actuel (peut changer en cas de reconnexion) */
  socketId: string;

  /** Nom d'affichage du joueur (2-20 caractères) */
  name: string;

  /** Si le joueur est l'hôte du lobby */
  isHost: boolean;

  /** Score total du joueur (optionnel, utilisé dans le game state) */
  score?: number;

  /** Si le joueur est actif dans le lobby (a cliqué sur rejouer après une partie) */
  isActive: boolean;

  /** ID de l'avatar choisi par le joueur */
  avatarId: number;
}