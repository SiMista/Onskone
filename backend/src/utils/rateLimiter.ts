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

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
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

  // Game actions: 30 per minute
  gameAction: new RateLimiter({ windowMs: 60000, maxRequests: 30 }),

  // General events: 60 per minute
  general: new RateLimiter({ windowMs: 60000, maxRequests: 60 }),
};
