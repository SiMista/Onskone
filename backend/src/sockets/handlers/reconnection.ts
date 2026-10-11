import { randomUUID } from 'crypto';
import type { ReclaimablePlayer } from '@onskone/shared';
import type { Lobby } from '../../models/Lobby';
import type { ServerPlayer } from '../../types/ServerPlayer.js';
import type { ConnectionRegistry } from '../ConnectionRegistry.js';
import type { AppSocket, IoServer } from '../broadcasting.js';
import { reassignSocket } from '../../managers/socketLobbyIndex.js';

/** Vrai si le socket associé au slot est encore vivant côté serveur. */
export function isSocketAlive(io: IoServer, socketId: string): boolean {
    const s = io.sockets.sockets.get(socketId);
    return !!s && s.connected;
}

/**
 * Vrai si ce socket tient déjà le slot d'un AUTRE joueur du salon. Un socket ne
 * peut appartenir qu'à un seul joueur : sinon deux slots partagent un socketId et
 * le handler `disconnect` (qui résout le joueur par socketId) n'en traiterait qu'un.
 * Reprendre SON propre slot avec son socket courant reste permis (idempotent).
 */
export function socketHoldsOtherSlot(lobby: Lobby, socketId: string, playerId: string): boolean {
    return lobby.players.some(p => p.socketId === socketId && p.id !== playerId);
}

/**
 * Preuve d'identité d'une reconnexion : le secret d'origine (`reconnectToken`, seul
 * titre de propriété du slot) ou le secret provisoire d'une reprise sans preuve
 * (`claimToken`), tant qu'il n'a pas été révoqué.
 */
export function tokenMatches(player: ServerPlayer, token: string | undefined): boolean {
    if (!token) return false;
    return token === player.reconnectToken || (!!player.claimToken && token === player.claimToken);
}

/**
 * Secret provisoire remis à qui reprend le slot SANS preuve (cf. reclaimPlayer).
 * Le secret d'origine reste valide : si son détenteur revient, il est le propriétaire
 * prouvé, reprend le slot (éviction du socket courant) et le secret provisoire est
 * révoqué (cf. revokeClaimIfProvenOwner). Un inconnu ne peut donc jamais
 * verrouiller un joueur hors de sa propre partie.
 */
export function issueClaimToken(player: ServerPlayer): string {
    player.claimToken = randomUUID();
    return player.claimToken;
}

/** Après une reconnexion prouvée par le secret D'ORIGINE : révoque toute reprise provisoire. */
export function revokeClaimIfProvenOwner(player: ServerPlayer, token: string | undefined): void {
    if (token === player.reconnectToken && player.claimToken) {
        player.claimToken = undefined;
    }
}

/**
 * Joueurs du salon dont la connexion est tombée : leur slot peut être repris sans
 * secret via `reclaimPlayer` (cf. lobbyInfo). Un socket vivant = joueur présent,
 * même s'il n'est pas encore marqué inactif.
 */
export function listReclaimablePlayers(io: IoServer, lobby: Lobby): ReclaimablePlayer[] {
    return lobby.players
        .filter(p => !isSocketAlive(io, p.socketId))
        .map(p => ({ id: p.id, name: p.name, avatarId: p.avatarId }));
}

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
