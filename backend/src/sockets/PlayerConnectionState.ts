import logger from '../utils/logger.js';

/**
 * Configuration for connection state timeouts
 */
export interface ConnectionTimeoutConfig {
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
export const DEFAULT_TIMEOUT_CONFIG: ConnectionTimeoutConfig = {
    reconnectGracePeriod: 30000,      // 30 seconds
    leaderDisconnectDelay: 15000,     // 15 seconds
    inactiveDelay: 5000,              // 5 seconds
    kickBlockDuration: 5 * 60 * 1000, // 5 minutes
};

/**
 * Types of connection-related timeouts
 */
type TimeoutType = 'disconnect' | 'inactive' | 'leader';

/**
 * Internal structure for tracking a player's connection state
 */
interface PlayerState {
    disconnectTimeout?: NodeJS.Timeout;
    inactiveTimeout?: NodeJS.Timeout;
    kickExpiration?: number;
}

/**
 * Internal structure for tracking a lobby's connection state
 */
interface LobbyState {
    leaderDisconnectTimeout?: NodeJS.Timeout;
    reconnectionLocks: Set<string>;
    players: Map<string, PlayerState>;
}

/**
 * Centralized manager for player connection states.
 *
 * Handles all timeout-based connection management:
 * - Disconnect timeouts (grace period before removal)
 * - Inactive timeouts (delay before marking as inactive)
 * - Leader disconnect timeouts (delay before skipping round)
 * - Kicked player tracking (temporary ban after kick)
 * - Reconnection locks (prevent race conditions)
 *
 * Benefits over separate Maps:
 * - Single source of truth for connection state
 * - Automatic cleanup when lobby is removed
 * - No memory leaks from orphaned timeouts
 * - Thread-safe reconnection handling
 * - Consistent key generation
 */
export class PlayerConnectionState {
    private lobbies: Map<string, LobbyState> = new Map();
    private config: ConnectionTimeoutConfig;

    constructor(config: Partial<ConnectionTimeoutConfig> = {}) {
        this.config = { ...DEFAULT_TIMEOUT_CONFIG, ...config };
    }

    // ===== PRIVATE HELPERS =====

    /**
     * Get or create lobby state
     */
    private getLobbyState(lobbyCode: string): LobbyState {
        let state = this.lobbies.get(lobbyCode);
        if (!state) {
            state = {
                reconnectionLocks: new Set(),
                players: new Map(),
            };
            this.lobbies.set(lobbyCode, state);
        }
        return state;
    }

    /**
     * Get or create player state within a lobby
     */
    private getPlayerState(lobbyCode: string, playerName: string): PlayerState {
        const lobbyState = this.getLobbyState(lobbyCode);
        let playerState = lobbyState.players.get(playerName);
        if (!playerState) {
            playerState = {};
            lobbyState.players.set(playerName, playerState);
        }
        return playerState;
    }

    /**
     * Clean up empty lobby state
     */
    private cleanupEmptyLobby(lobbyCode: string): void {
        const state = this.lobbies.get(lobbyCode);
        if (state &&
            !state.leaderDisconnectTimeout &&
            state.reconnectionLocks.size === 0 &&
            state.players.size === 0) {
            this.lobbies.delete(lobbyCode);
        }
    }

    /**
     * Clean up empty player state
     */
    private cleanupEmptyPlayer(lobbyCode: string, playerName: string): void {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return;

        const playerState = lobbyState.players.get(playerName);
        if (playerState &&
            !playerState.disconnectTimeout &&
            !playerState.inactiveTimeout &&
            !playerState.kickExpiration) {
            lobbyState.players.delete(playerName);
            this.cleanupEmptyLobby(lobbyCode);
        }
    }

    // ===== PUBLIC API: TIMEOUTS =====

    /**
     * Set a disconnect timeout for a player (grace period before removal)
     */
    setDisconnectTimeout(
        lobbyCode: string,
        playerName: string,
        callback: () => void,
        duration: number = this.config.reconnectGracePeriod
    ): void {
        const playerState = this.getPlayerState(lobbyCode, playerName);

        // Clear existing timeout if any
        if (playerState.disconnectTimeout) {
            clearTimeout(playerState.disconnectTimeout);
        }

        playerState.disconnectTimeout = setTimeout(() => {
            // Auto-cleanup before callback
            playerState.disconnectTimeout = undefined;
            this.cleanupEmptyPlayer(lobbyCode, playerName);
            callback();
        }, duration);

        logger.debug(`Disconnect timeout set for ${playerName} in ${lobbyCode} (${duration}ms)`);
    }

    /**
     * Cancel a disconnect timeout for a player
     */
    cancelDisconnectTimeout(lobbyCode: string, playerName: string): boolean {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return false;

        const playerState = lobbyState.players.get(playerName);
        if (!playerState?.disconnectTimeout) return false;

        clearTimeout(playerState.disconnectTimeout);
        playerState.disconnectTimeout = undefined;
        this.cleanupEmptyPlayer(lobbyCode, playerName);

        logger.debug(`Disconnect timeout cancelled for ${playerName} in ${lobbyCode}`);
        return true;
    }

    /**
     * Check if a player has an active disconnect timeout
     */
    hasDisconnectTimeout(lobbyCode: string, playerName: string): boolean {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return false;
        const playerState = lobbyState.players.get(playerName);
        return !!playerState?.disconnectTimeout;
    }

    /**
     * Set an inactive timeout for a player (delay before marking as inactive)
     */
    setInactiveTimeout(
        lobbyCode: string,
        playerName: string,
        callback: () => void,
        duration: number = this.config.inactiveDelay
    ): void {
        const playerState = this.getPlayerState(lobbyCode, playerName);

        // Clear existing timeout if any
        if (playerState.inactiveTimeout) {
            clearTimeout(playerState.inactiveTimeout);
        }

        playerState.inactiveTimeout = setTimeout(() => {
            // Auto-cleanup before callback
            playerState.inactiveTimeout = undefined;
            this.cleanupEmptyPlayer(lobbyCode, playerName);
            callback();
        }, duration);

        logger.debug(`Inactive timeout set for ${playerName} in ${lobbyCode} (${duration}ms)`);
    }

    /**
     * Cancel an inactive timeout for a player
     */
    cancelInactiveTimeout(lobbyCode: string, playerName: string): boolean {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return false;

        const playerState = lobbyState.players.get(playerName);
        if (!playerState?.inactiveTimeout) return false;

        clearTimeout(playerState.inactiveTimeout);
        playerState.inactiveTimeout = undefined;
        this.cleanupEmptyPlayer(lobbyCode, playerName);

        logger.debug(`Inactive timeout cancelled for ${playerName} in ${lobbyCode}`);
        return true;
    }

    /**
     * Set a leader disconnect timeout (delay before skipping round)
     */
    setLeaderDisconnectTimeout(
        lobbyCode: string,
        callback: () => void,
        duration: number = this.config.leaderDisconnectDelay
    ): void {
        const lobbyState = this.getLobbyState(lobbyCode);

        // Clear existing timeout if any
        if (lobbyState.leaderDisconnectTimeout) {
            clearTimeout(lobbyState.leaderDisconnectTimeout);
        }

        lobbyState.leaderDisconnectTimeout = setTimeout(() => {
            // Auto-cleanup before callback
            lobbyState.leaderDisconnectTimeout = undefined;
            this.cleanupEmptyLobby(lobbyCode);
            callback();
        }, duration);

        logger.debug(`Leader disconnect timeout set for ${lobbyCode} (${duration}ms)`);
    }

    /**
     * Cancel a leader disconnect timeout
     */
    cancelLeaderDisconnectTimeout(lobbyCode: string): boolean {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState?.leaderDisconnectTimeout) return false;

        clearTimeout(lobbyState.leaderDisconnectTimeout);
        lobbyState.leaderDisconnectTimeout = undefined;
        this.cleanupEmptyLobby(lobbyCode);

        logger.debug(`Leader disconnect timeout cancelled for ${lobbyCode}`);
        return true;
    }

    // ===== PUBLIC API: KICKED PLAYERS =====

    /**
     * Block a player after being kicked
     */
    blockKickedPlayer(
        lobbyCode: string,
        playerName: string,
        duration: number = this.config.kickBlockDuration
    ): void {
        const playerState = this.getPlayerState(lobbyCode, playerName);
        playerState.kickExpiration = Date.now() + duration;
        logger.debug(`Player ${playerName} blocked from ${lobbyCode} for ${duration / 1000}s`);
    }

    /**
     * Check if a player is currently blocked (was kicked recently)
     * Auto-cleans expired entries
     */
    isPlayerKicked(lobbyCode: string, playerName: string): boolean {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return false;

        const playerState = lobbyState.players.get(playerName);
        if (!playerState?.kickExpiration) return false;

        if (Date.now() > playerState.kickExpiration) {
            // Block expired, clean up
            playerState.kickExpiration = undefined;
            this.cleanupEmptyPlayer(lobbyCode, playerName);
            return false;
        }

        return true;
    }

    // ===== PUBLIC API: RECONNECTION LOCKS =====

    /**
     * Acquire a reconnection lock for a player
     * Returns true if lock was acquired, false if already locked
     */
    acquireReconnectionLock(lobbyCode: string, playerName: string): boolean {
        const lobbyState = this.getLobbyState(lobbyCode);

        if (lobbyState.reconnectionLocks.has(playerName)) {
            logger.debug(`Reconnection lock already held for ${playerName} in ${lobbyCode}`);
            return false;
        }

        lobbyState.reconnectionLocks.add(playerName);
        logger.debug(`Reconnection lock acquired for ${playerName} in ${lobbyCode}`);
        return true;
    }

    /**
     * Release a reconnection lock for a player
     */
    releaseReconnectionLock(lobbyCode: string, playerName: string): void {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return;

        lobbyState.reconnectionLocks.delete(playerName);
        this.cleanupEmptyLobby(lobbyCode);
        logger.debug(`Reconnection lock released for ${playerName} in ${lobbyCode}`);
    }

    /**
     * Check if a reconnection lock is held
     */
    hasReconnectionLock(lobbyCode: string, playerName: string): boolean {
        const lobbyState = this.lobbies.get(lobbyCode);
        return lobbyState?.reconnectionLocks.has(playerName) ?? false;
    }

    // ===== PUBLIC API: BULK OPERATIONS =====

    /**
     * Cancel all player timeouts (both disconnect and inactive)
     */
    cancelAllPlayerTimeouts(lobbyCode: string, playerName: string): void {
        this.cancelDisconnectTimeout(lobbyCode, playerName);
        this.cancelInactiveTimeout(lobbyCode, playerName);
    }

    /**
     * Clean up all resources for a specific lobby
     * Call this when a lobby is being deleted
     */
    cleanupLobby(lobbyCode: string): void {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return;

        let disconnectCount = 0;
        let inactiveCount = 0;
        let kickedCount = 0;

        // Clean up all player states
        for (const [playerName, playerState] of lobbyState.players.entries()) {
            if (playerState.disconnectTimeout) {
                clearTimeout(playerState.disconnectTimeout);
                disconnectCount++;
            }
            if (playerState.inactiveTimeout) {
                clearTimeout(playerState.inactiveTimeout);
                inactiveCount++;
            }
            if (playerState.kickExpiration) {
                kickedCount++;
            }
        }

        // Clean up leader timeout
        if (lobbyState.leaderDisconnectTimeout) {
            clearTimeout(lobbyState.leaderDisconnectTimeout);
        }

        const lockCount = lobbyState.reconnectionLocks.size;

        // Remove entire lobby state
        this.lobbies.delete(lobbyCode);

        if (disconnectCount > 0 || inactiveCount > 0 || lockCount > 0 || kickedCount > 0) {
            logger.debug(
                `Cleanup lobby ${lobbyCode}: ${disconnectCount} disconnect, ` +
                `${inactiveCount} inactive, ${lockCount} locks, ${kickedCount} kicked`
            );
        }
    }

    // ===== PUBLIC API: DIAGNOSTICS =====

    /**
     * Get configuration (for testing/debugging)
     */
    getConfig(): Readonly<ConnectionTimeoutConfig> {
        return { ...this.config };
    }

    /**
     * Get statistics for a lobby (for testing/debugging)
     */
    getLobbyStats(lobbyCode: string): {
        playerCount: number;
        disconnectTimeouts: number;
        inactiveTimeouts: number;
        kickedPlayers: number;
        reconnectionLocks: number;
        hasLeaderTimeout: boolean;
    } | null {
        const lobbyState = this.lobbies.get(lobbyCode);
        if (!lobbyState) return null;

        let disconnectTimeouts = 0;
        let inactiveTimeouts = 0;
        let kickedPlayers = 0;

        for (const playerState of lobbyState.players.values()) {
            if (playerState.disconnectTimeout) disconnectTimeouts++;
            if (playerState.inactiveTimeout) inactiveTimeouts++;
            if (playerState.kickExpiration && Date.now() < playerState.kickExpiration) {
                kickedPlayers++;
            }
        }

        return {
            playerCount: lobbyState.players.size,
            disconnectTimeouts,
            inactiveTimeouts,
            kickedPlayers,
            reconnectionLocks: lobbyState.reconnectionLocks.size,
            hasLeaderTimeout: !!lobbyState.leaderDisconnectTimeout,
        };
    }

    /**
     * Get total number of tracked lobbies
     */
    getTotalLobbies(): number {
        return this.lobbies.size;
    }
}
