/**
 * Simple rate limiter for socket events
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxEntries = 50000; // Limite à 50K entrées pour éviter les DOS mémoire

    // Cleanup old entries every minute
    this.cleanupIntervalId = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  stop(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.limits.clear();
  }

  /**
   * Check if a request should be allowed
   * @param key Unique identifier (e.g., socket.id or IP)
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // Vérifier la limite de taille avant d'ajouter
      if (this.limits.size >= this.maxEntries) {
        // Supprimer les entrées expirées d'abord
        this.cleanup();
        // Si toujours trop plein, supprimer les plus anciennes
        if (this.limits.size >= this.maxEntries) {
          const keysToDelete = Array.from(this.limits.keys()).slice(0, 1000);
          keysToDelete.forEach(k => this.limits.delete(k));
        }
      }

      // First request or window expired
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Pre-configured rate limiters for different event types
export const rateLimiters = {
  // Lobby creation: 5 per minute
  createLobby: new RateLimiter({ windowMs: 60000, maxRequests: 5 }),

  // Join lobby: 10 per minute
  joinLobby: new RateLimiter({ windowMs: 60000, maxRequests: 10 }),

  // Game actions: 30 per minute (start game, next round)
  gameAction: new RateLimiter({ windowMs: 60000, maxRequests: 30 }),

  // Answer submission: 10 per minute (should only need 1 per round)
  submitAnswer: new RateLimiter({ windowMs: 60000, maxRequests: 10 }),

  // Guess updates: 120 per minute (frequent drag & drop)
  updateGuess: new RateLimiter({ windowMs: 60000, maxRequests: 120 }),

  // Guess submission: 10 per minute (should only need 1 per round)
  submitGuesses: new RateLimiter({ windowMs: 60000, maxRequests: 10 }),

  // Question selection: 10 per minute
  selectQuestion: new RateLimiter({ windowMs: 60000, maxRequests: 10 }),

  // Request questions (relances): 20 per minute
  requestQuestions: new RateLimiter({ windowMs: 60000, maxRequests: 20 }),

  // Kick player: 10 per minute
  kickPlayer: new RateLimiter({ windowMs: 60000, maxRequests: 10 }),

  // Reveal answer: 30 per minute
  revealAnswer: new RateLimiter({ windowMs: 60000, maxRequests: 30 }),

  // General events: 60 per minute
  general: new RateLimiter({ windowMs: 60000, maxRequests: 60 }),
};

/**
 * Stop all rate limiters (for graceful shutdown)
 */
export function stopAllRateLimiters(): void {
  Object.values(rateLimiters).forEach(limiter => limiter.stop());
}
