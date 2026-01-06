import logger from '../../utils/logger.js';

/**
 * Centralized timeout management for socket disconnections and reconnections.
 * Handles disconnect timeouts, leader disconnect timeouts, inactive timeouts, and kicked players.
 */
export class TimeoutManager {
    // Map pour stocker les timeouts de déconnexion (clé: lobbyCode_playerName)
    private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Map pour stocker les timeouts de déconnexion du pilier (clé: lobbyCode)
    private leaderDisconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Set pour empêcher les reconnexions simultanées (clé: lobbyCode_playerName)
    private reconnectionLocks: Set<string> = new Set();
    // Map pour stocker les timeouts d'inactivité (clé: lobbyCode_playerName)
    private inactiveTimeouts: Map<string, NodeJS.Timeout> = new Map();
    // Map pour stocker les joueurs kickés temporairement (clé: lobbyCode_playerName, valeur: timestamp d'expiration)
    private kickedPlayers: Map<string, number> = new Map();

    // Délai de grâce pour la reconnexion (30 secondes)
    public readonly RECONNECT_GRACE_PERIOD = 30000;
    // Délai avant de sauter le round du pilier déconnecté (15 secondes - pour le changement d'app mobile)
    public readonly LEADER_DISCONNECT_DELAY = 15000;
    // Délai avant de marquer un joueur comme inactif (5 secondes - pour le changement d'app mobile)
    public readonly INACTIVE_DELAY = 5000;
    // Durée du blocage après kick (5 minutes)
    public readonly KICK_BLOCK_DURATION = 5 * 60 * 1000;

    getDisconnectKey(lobbyCode: string, playerName: string): string {
        return `${lobbyCode}_${playerName}`;
    }

    // ===== DISCONNECT TIMEOUTS =====

    setDisconnectTimeout(lobbyCode: string, playerName: string, callback: () => void): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        this.cancelDisconnectTimeout(lobbyCode, playerName);
        const timeout = setTimeout(() => {
            this.disconnectTimeouts.delete(key);
            callback();
        }, this.RECONNECT_GRACE_PERIOD);
        this.disconnectTimeouts.set(key, timeout);
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

    hasDisconnectTimeout(lobbyCode: string, playerName: string): boolean {
        return this.disconnectTimeouts.has(this.getDisconnectKey(lobbyCode, playerName));
    }

    // ===== LEADER DISCONNECT TIMEOUTS =====

    setLeaderDisconnectTimeout(lobbyCode: string, callback: () => void): void {
        this.cancelLeaderDisconnectTimeout(lobbyCode);
        const timeout = setTimeout(() => {
            this.leaderDisconnectTimeouts.delete(lobbyCode);
            callback();
        }, this.LEADER_DISCONNECT_DELAY);
        this.leaderDisconnectTimeouts.set(lobbyCode, timeout);
    }

    cancelLeaderDisconnectTimeout(lobbyCode: string): void {
        const timeout = this.leaderDisconnectTimeouts.get(lobbyCode);
        if (timeout) {
            clearTimeout(timeout);
            this.leaderDisconnectTimeouts.delete(lobbyCode);
            logger.debug(`Timeout de déconnexion du pilier annulé pour ${lobbyCode}`);
        }
    }

    // ===== INACTIVE TIMEOUTS =====

    setInactiveTimeout(lobbyCode: string, playerName: string, callback: () => void): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        this.cancelInactiveTimeout(lobbyCode, playerName);
        const timeout = setTimeout(() => {
            this.inactiveTimeouts.delete(key);
            callback();
        }, this.INACTIVE_DELAY);
        this.inactiveTimeouts.set(key, timeout);
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

    // ===== RECONNECTION LOCKS =====

    acquireReconnectionLock(lobbyCode: string, playerName: string): boolean {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        if (this.reconnectionLocks.has(key)) {
            return false;
        }
        this.reconnectionLocks.add(key);
        return true;
    }

    releaseReconnectionLock(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        this.reconnectionLocks.delete(key);
    }

    hasReconnectionLock(lobbyCode: string, playerName: string): boolean {
        return this.reconnectionLocks.has(this.getDisconnectKey(lobbyCode, playerName));
    }

    // ===== KICKED PLAYERS =====

    isPlayerKicked(lobbyCode: string, playerName: string): boolean {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        const expiration = this.kickedPlayers.get(key);

        if (!expiration) return false;

        if (Date.now() > expiration) {
            this.kickedPlayers.delete(key);
            return false;
        }

        return true;
    }

    blockKickedPlayer(lobbyCode: string, playerName: string): void {
        const key = this.getDisconnectKey(lobbyCode, playerName);
        this.kickedPlayers.set(key, Date.now() + this.KICK_BLOCK_DURATION);
        logger.debug(`Joueur ${playerName} bloqué du lobby ${lobbyCode} pour ${this.KICK_BLOCK_DURATION / 1000}s`);
    }

    // ===== LOBBY CLEANUP =====

    cleanupLobbyResources(lobbyCode: string): void {
        // Clean up all disconnect timeouts for this lobby
        const keysToDelete: string[] = [];
        for (const [key, timeout] of this.disconnectTimeouts.entries()) {
            if (key.startsWith(`${lobbyCode}_`)) {
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
            if (key.startsWith(`${lobbyCode}_`)) {
                locksToDelete.push(key);
            }
        }
        locksToDelete.forEach(key => this.reconnectionLocks.delete(key));

        // Clean up kicked players list for this lobby
        const kickedToDelete: string[] = [];
        for (const key of this.kickedPlayers.keys()) {
            if (key.startsWith(`${lobbyCode}_`)) {
                kickedToDelete.push(key);
            }
        }
        kickedToDelete.forEach(key => this.kickedPlayers.delete(key));

        // Clean up inactive timeouts for this lobby
        const inactiveToDelete: string[] = [];
        for (const [key, timeout] of this.inactiveTimeouts.entries()) {
            if (key.startsWith(`${lobbyCode}_`)) {
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

// Singleton instance
export const timeoutManager = new TimeoutManager();
