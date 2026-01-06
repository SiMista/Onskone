import logger from '../../utils/logger.js';

/**
 * Configuration for timeout durations
 */
export interface TimeoutConfig {
    /** Grace period for reconnection (default: 30s) */
    reconnectGracePeriod: number;
    /** Delay before skipping leader's round (default: 15s) */
    leaderDisconnectDelay: number;
    /** Delay before marking player as inactive (default: 5s) */
    inactiveDelay: number;
    /** Duration of kick block (default: 5min) */
    kickBlockDuration: number;
}

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
    reconnectGracePeriod: 30000,      // 30 seconds
    leaderDisconnectDelay: 15000,     // 15 seconds
    inactiveDelay: 5000,              // 5 seconds
    kickBlockDuration: 5 * 60 * 1000, // 5 minutes
};

/**
 * Lobby statistics for diagnostics
 */
export interface LobbyStats {
    disconnectTimeouts: number;
    inactiveTimeouts: number;
    reconnectionLocks: number;
    kickedPlayers: number;
    hasLeaderTimeout: boolean;
}

/**
 * Centralized timeout management for socket disconnections and reconnections.
 * Handles disconnect timeouts, leader disconnect timeouts, inactive timeouts, and kicked players.
 *
 * Benefits:
 * - Single source of truth for connection state
 * - Automatic cleanup when lobby is removed (no memory leaks)
 * - Thread-safe reconnection handling via locks
 * - Diagnostic methods for debugging
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

    // Configuration (public readonly pour rétrocompatibilité)
    public readonly RECONNECT_GRACE_PERIOD: number;
    public readonly LEADER_DISCONNECT_DELAY: number;
    public readonly INACTIVE_DELAY: number;
    public readonly KICK_BLOCK_DURATION: number;

    constructor(config: Partial<TimeoutConfig> = {}) {
        const mergedConfig = { ...DEFAULT_TIMEOUT_CONFIG, ...config };
        this.RECONNECT_GRACE_PERIOD = mergedConfig.reconnectGracePeriod;
        this.LEADER_DISCONNECT_DELAY = mergedConfig.leaderDisconnectDelay;
        this.INACTIVE_DELAY = mergedConfig.inactiveDelay;
        this.KICK_BLOCK_DURATION = mergedConfig.kickBlockDuration;
    }

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

    // ===== UTILITY METHODS =====

    /**
     * Cancel all player timeouts (both disconnect and inactive)
     * Useful when a player reconnects
     */
    cancelAllPlayerTimeouts(lobbyCode: string, playerName: string): void {
        this.cancelDisconnectTimeout(lobbyCode, playerName);
        this.cancelInactiveTimeout(lobbyCode, playerName);
    }

    // ===== DIAGNOSTIC METHODS =====

    /**
     * Get statistics for a specific lobby
     * Useful for debugging and monitoring
     */
    getLobbyStats(lobbyCode: string): LobbyStats {
        const prefix = `${lobbyCode}_`;

        let disconnectTimeouts = 0;
        let inactiveTimeouts = 0;
        let reconnectionLocks = 0;
        let kickedPlayers = 0;

        for (const key of this.disconnectTimeouts.keys()) {
            if (key.startsWith(prefix)) disconnectTimeouts++;
        }
        for (const key of this.inactiveTimeouts.keys()) {
            if (key.startsWith(prefix)) inactiveTimeouts++;
        }
        for (const key of this.reconnectionLocks) {
            if (key.startsWith(prefix)) reconnectionLocks++;
        }
        for (const [key, expiration] of this.kickedPlayers.entries()) {
            if (key.startsWith(prefix) && Date.now() < expiration) kickedPlayers++;
        }

        return {
            disconnectTimeouts,
            inactiveTimeouts,
            reconnectionLocks,
            kickedPlayers,
            hasLeaderTimeout: this.leaderDisconnectTimeouts.has(lobbyCode),
        };
    }

    /**
     * Get total counts across all lobbies
     * Useful for monitoring memory usage
     */
    getTotalStats(): {
        totalDisconnectTimeouts: number;
        totalInactiveTimeouts: number;
        totalReconnectionLocks: number;
        totalKickedPlayers: number;
        totalLeaderTimeouts: number;
    } {
        return {
            totalDisconnectTimeouts: this.disconnectTimeouts.size,
            totalInactiveTimeouts: this.inactiveTimeouts.size,
            totalReconnectionLocks: this.reconnectionLocks.size,
            totalKickedPlayers: this.kickedPlayers.size,
            totalLeaderTimeouts: this.leaderDisconnectTimeouts.size,
        };
    }
}

// Singleton instance
export const timeoutManager = new TimeoutManager();
