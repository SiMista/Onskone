import { GAME_CONSTANTS } from '@onskone/shared';
import logger from '../utils/logger.js';

/**
 * ConnectionRegistry — détenteur UNIQUE de tout l'état de connexion volatile lié aux
 * lobbies : les timeouts de déconnexion / inactivité / saut de pilier, les locks de
 * reconnexion et la liste des joueurs kickés temporairement.
 *
 * C'est le SEUL endroit du code socket qui mute ces maps. Les handlers passent par les
 * méthodes publiques ci-dessous, ce qui garantit l'invariant « une seule source de vérité
 * pour les timers » et centralise la dérivation des clés.
 *
 * ── Choix de la clé ──
 * La clé reste basée sur `${lobbyCode}_${playerName}` plutôt que sur `player.id` :
 *  - `kickedPlayers` est consulté dans `joinLobby` AVANT qu'un objet Player n'existe
 *    (le joueur a justement été retiré du lobby), donc seul le nom est disponible.
 *  - La logique de reconnexion « même nom = reconnexion » résout le joueur par nom ;
 *    poser/annuler les timeouts par nom reste cohérent avec ce mécanisme.
 *  - `cleanupLobbyResources` balaie les clés par préfixe `${lobbyCode}_`.
 * La dérivation de clé est néanmoins CENTRALISÉE ici (`getDisconnectKey`) : un seul point
 * à faire évoluer le jour où l'on voudra basculer sur l'UUID stable.
 */
export class ConnectionRegistry {
    // Map pour stocker les timeouts de déconnexion (clé: lobbyCode_playerName)
    private readonly disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Map pour stocker les timeouts de déconnexion du pilier (clé: lobbyCode)
    private readonly leaderDisconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Map pour stocker les timeouts d'inactivité (clé: lobbyCode_playerName)
    private readonly inactiveTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Set pour empêcher les reconnexions simultanées (clé: lobbyCode_playerName)
    private readonly reconnectionLocks: Set<string> = new Set();
    // Map pour stocker les joueurs kickés temporairement (clé: lobbyCode_playerName, valeur: timestamp d'expiration)
    private readonly kickedPlayers: Map<string, number> = new Map();

    // Durée du blocage après un kick — source de vérité dans shared/src/constants.ts.
    private readonly KICK_BLOCK_DURATION = GAME_CONSTANTS.KICK_BLOCK_DURATION_MS;

    getDisconnectKey(lobbyCode: string, playerName: string): string {
        return `${lobbyCode}_${playerName}`;
    }

    // ===== Disconnect timeouts =====

    hasDisconnectTimeout(lobbyCode: string, playerName: string): boolean {
        return this.disconnectTimeouts.has(this.getDisconnectKey(lobbyCode, playerName));
    }

    setDisconnectTimeout(lobbyCode: string, playerName: string, timeout: NodeJS.Timeout): void {
        this.disconnectTimeouts.set(this.getDisconnectKey(lobbyCode, playerName), timeout);
    }

    deleteDisconnectTimeout(lobbyCode: string, playerName: string): void {
        this.disconnectTimeouts.delete(this.getDisconnectKey(lobbyCode, playerName));
    }

    cancelDisconnectTimeout(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        const timeout = this.disconnectTimeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.disconnectTimeouts.delete(key);
            logger.debug(`Timeout de déconnexion annulé pour ${playerName} dans ${lobbyCode}`);
        }
    }

    // ===== Leader disconnect timeouts =====

    setLeaderDisconnectTimeout(lobbyCode: string, timeout: NodeJS.Timeout): void {
        this.leaderDisconnectTimeouts.set(lobbyCode, timeout);
    }

    deleteLeaderDisconnectTimeout(lobbyCode: string): void {
        this.leaderDisconnectTimeouts.delete(lobbyCode);
    }

    cancelLeaderDisconnectTimeout(lobbyCode: string): void {
        const timeout = this.leaderDisconnectTimeouts.get(lobbyCode);
        if (timeout) {
            clearTimeout(timeout);
            this.leaderDisconnectTimeouts.delete(lobbyCode);
            logger.debug(`Timeout de déconnexion du pilier annulé pour ${lobbyCode}`);
        }
    }

    // ===== Inactive timeouts =====

    setInactiveTimeout(lobbyCode: string, playerName: string, timeout: NodeJS.Timeout): void {
        this.inactiveTimeouts.set(this.getDisconnectKey(lobbyCode, playerName), timeout);
    }

    deleteInactiveTimeout(lobbyCode: string, playerName: string): void {
        this.inactiveTimeouts.delete(this.getDisconnectKey(lobbyCode, playerName));
    }

    cancelInactiveTimeout(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        const timeout = this.inactiveTimeouts.get(key);
        if (timeout) {
            clearTimeout(timeout);
            this.inactiveTimeouts.delete(key);
            logger.debug(`Timeout d'inactivité annulé pour ${playerName} dans ${lobbyCode}`);
        }
    }

    // ===== Reconnection locks =====

    hasReconnectionLock(lobbyCode: string, playerName: string): boolean {
        return this.reconnectionLocks.has(this.getDisconnectKey(lobbyCode, playerName));
    }

    acquireReconnectionLock(lobbyCode: string, playerName: string): void {
        this.reconnectionLocks.add(this.getDisconnectKey(lobbyCode, playerName));
    }

    releaseReconnectionLock(lobbyCode: string, playerName: string): void {
        this.reconnectionLocks.delete(this.getDisconnectKey(lobbyCode, playerName));
    }

    // ===== Kicked players =====

    /**
     * Vérifie si un joueur est bloqué (a été kické récemment).
     * Nettoie automatiquement les entrées expirées.
     */
    isPlayerKicked(lobbyCode: string, playerName: string): boolean {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        const expiration = this.kickedPlayers.get(key);

        if (!expiration) return false;

        if (Date.now() > expiration) {
            // Le blocage a expiré, nettoyer l'entrée
            this.kickedPlayers.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Bloque un joueur après un kick.
     */
    blockKickedPlayer(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        this.kickedPlayers.set(key, Date.now() + this.KICK_BLOCK_DURATION);
        logger.debug(`Joueur ${playerName} bloqué du lobby ${lobbyCode} pour ${this.KICK_BLOCK_DURATION / 1000}s`);
    }

    // ===== Lobby-wide cleanup =====

    /**
     * Nettoie tous les timeouts (déconnexion, pilier, inactivité), les locks de
     * reconnexion et les entrées de joueurs kickés appartenant à un lobby donné.
     */
    cleanupLobbyResources(lobbyCode: string): void {
        const prefix = `${lobbyCode}_`;

        // Clean up all disconnect timeouts for this lobby
        const keysToDelete: string[] = [];
        for (const [key, timeout] of this.disconnectTimeouts.entries()) {
            if (key.startsWith(prefix)) {
                clearTimeout(timeout);
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.disconnectTimeouts.delete(key));

        // Clean up leader disconnect timeout for this lobby
        this.cancelLeaderDisconnectTimeout(lobbyCode);

        // Clean up all reconnection locks for this lobby
        const locksToDelete: string[] = [];
        for (const key of this.reconnectionLocks) {
            if (key.startsWith(prefix)) {
                locksToDelete.push(key);
            }
        }
        locksToDelete.forEach(key => this.reconnectionLocks.delete(key));

        // Clean up kicked players list for this lobby
        const kickedToDelete: string[] = [];
        for (const key of this.kickedPlayers.keys()) {
            if (key.startsWith(prefix)) {
                kickedToDelete.push(key);
            }
        }
        kickedToDelete.forEach(key => this.kickedPlayers.delete(key));

        // Clean up inactive timeouts for this lobby
        const inactiveToDelete: string[] = [];
        for (const [key, timeout] of this.inactiveTimeouts.entries()) {
            if (key.startsWith(prefix)) {
                clearTimeout(timeout);
                inactiveToDelete.push(key);
            }
        }
        inactiveToDelete.forEach(key => this.inactiveTimeouts.delete(key));

        if (keysToDelete.length > 0 || locksToDelete.length > 0 || kickedToDelete.length > 0 || inactiveToDelete.length > 0) {
            logger.debug(`Nettoyage lobby ${lobbyCode}: ${keysToDelete.length} disconnect timeouts, ${inactiveToDelete.length} inactive timeouts, ${locksToDelete.length} locks, ${kickedToDelete.length} kicked`);
        }
    }
}
