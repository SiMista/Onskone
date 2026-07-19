/**
 * Joueur dans un lobby ou une partie
 */
export interface IPlayer {
  /** Identifiant unique du joueur (UUID) */
  id: string;

  /**
   * ID du socket actuel (peut changer en cas de reconnexion).
   * SERVER-ONLY : jamais diffusé aux clients (cf. serializePlayer côté backend).
   * Optionnel dans le contrat car les payloads publics l'omettent.
   */
  socketId?: string;

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

  /**
   * Statut premium du joueur (déclaré au handshake socket). Diffusé aux clients
   * pour afficher le pseudo doré + le cadre avatar premium à toute la table.
   * Auto-déclaré côté client (falsifiable, enjeu cosmétique assumé).
   */
  isPremium?: boolean;
}