import type { Lobby } from '../../models/Lobby';
import type { ServerPlayer } from '../../types/ServerPlayer.js';
import type { ConnectionRegistry } from '../ConnectionRegistry.js';
import type { AppSocket } from '../broadcasting.js';
import { reassignSocket } from '../../managers/socketLobbyIndex.js';

/**
 * Cœur PARTAGÉ de la reconnexion d'un joueur à son slot, extrait de `joinLobby`
 * (chemin « joueur existant par nom ») et de `getGameState` (chemin `playerId`).
 *
 * Ne contient QUE les mutations strictement identiques aux deux appelants :
 *   - annulation des timeouts de déconnexion + inactivité,
 *   - réassociation du slot au nouveau socket (socketId + isActive + index + room),
 *   - si le joueur est le pilier courant : annulation du saut de round + MAJ socketId.
 *
 * Volontairement HORS de ce helper (car divergents entre les deux appelants) :
 *   - le pré-check token/liveness (codes/messages d'erreur distincts),
 *   - l'acquisition/relâche du lock de reconnexion (le comportement « lock déjà tenu »
 *     diffère : `joinLobby` émet une erreur et abandonne, `getGameState` envoie l'état
 *     sans muter),
 *   - le rafraîchissement `isPremium` (uniquement `joinLobby`),
 *   - les emits (`joinedLobby`/`gameStarted` + `updatePlayersList` vs `gameState`), dont
 *     l'ORDRE relatif à `updatePlayersList` diffère — chaque appelant garde donc ses
 *     propres emits pour préserver la séquence exacte reçue par le client.
 *
 * L'appelant DOIT invoquer ce helper à l'intérieur de son bloc `try` (sous lock).
 */
export function reconnectPlayerSlot(
    registry: ConnectionRegistry,
    lobby: Lobby,
    player: ServerPlayer,
    socket: AppSocket,
): void {
    // Annuler les timeouts de déconnexion et d'inactivité (le slot est réclamé).
    // Les clés du registry sont insensibles à la casse : passer `player.name`
    // (nom réellement stocké) produit la même clé que le `sanitizedName` d'origine.
    registry.cancelDisconnectTimeout(lobby.code, player.name);
    registry.cancelInactiveTimeout(lobby.code, player.name);

    // Réassocier le slot au nouveau socket + tenir l'index socketId -> lobby à jour.
    const oldSocketId = player.socketId;
    player.socketId = socket.id;
    player.isActive = true;
    reassignSocket(oldSocketId, socket.id, lobby.code);
    socket.join(lobby.code);

    // Si c'est le pilier du round courant, annuler le saut de round + MAJ son socketId.
    // (`round.leader` est la MÊME référence que le player du lobby — cf. Game.nextRound —
    //  donc l'assignation ci-dessus l'a déjà couvert ; on reste explicite comme l'original.)
    const round = lobby.game?.currentRound;
    if (round && round.leader.id === player.id) {
        registry.cancelLeaderDisconnectTimeout(lobby.code);
        round.leader.socketId = socket.id;
    }
}
