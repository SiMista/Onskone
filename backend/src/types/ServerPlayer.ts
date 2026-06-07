import type { IPlayer } from '@onskone/shared';

/**
 * Vue SERVEUR d'un joueur : le contrat public `IPlayer` (shared) augmenté des
 * champs qui ne quittent JAMAIS le serveur.
 *
 * - `socketId` : id de connexion courant. Optionnel dans `IPlayer` (les payloads
 *   publics l'omettent) mais TOUJOURS présent côté serveur — on le repasse en
 *   requis ici pour conserver la rigueur de typage des handlers.
 * - `reconnectToken` : secret de reconnexion (anti-usurpation). Émis uniquement au
 *   propriétaire via lobbyCreated/joinedLobby, jamais diffusé (omis par
 *   serializePlayer).
 *
 * Le modèle `Player` implémente ce type ; `Lobby.players` et `Round.leader` le
 * portent pour que `p.socketId` / `p.reconnectToken` restent typés sans cast.
 */
export interface ServerPlayer extends IPlayer {
    socketId: string;
    reconnectToken: string;
}
