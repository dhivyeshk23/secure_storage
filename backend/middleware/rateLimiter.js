/**
 * Rate Limiter Middleware — In-memory sliding window rate limiter.
 * Protects sensitive endpoints (decryption, key operations) from abuse.
 */

class RateLimiter {
  constructor() {
    this._windows = new Map();    // key -> [{ timestamp }]
    this._cooldowns = new Map();  // key -> lastAccessTimestamp
  }

  /**
   * Check if a request is within rate limits.
   * @param {string} key - Unique key (e.g., userId + endpoint)
   * @param {number} maxRequests - Max requests in window
   * @param {number} windowMs - Window size in milliseconds
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
   */
  check(key, maxRequests, windowMs) {
    const now = Date.now();

    if (!this._windows.has(key)) {
      this._windows.set(key, []);
    }

    // Remove expired entries
    const entries = this._windows.get(key).filter(ts => (now - ts) < windowMs);
    this._windows.set(key, entries);

    if (entries.length >= maxRequests) {
      const oldest = entries[0];
      const retryAfterMs = windowMs - (now - oldest);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        message: `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`
      };
    }

    entries.push(now);
    return {
      allowed: true,
      remaining: maxRequests - entries.length,
      retryAfterMs: 0,
      message: 'OK'
    };
  }

  /**
   * Check access cooldown (minimum time between accesses to same resource).
   * @param {string} key - Unique key (e.g., userId + itemId)
   * @param {number} cooldownMs - Minimum milliseconds between accesses
   */
  checkCooldown(key, cooldownMs) {
    const now = Date.now();
    const lastAccess = this._cooldowns.get(key);

    if (lastAccess && (now - lastAccess) < cooldownMs) {
      const waitMs = cooldownMs - (now - lastAccess);
      return {
        allowed: false,
        waitMs,
        message: `Access cooldown active. Wait ${Math.ceil(waitMs / 1000)}s before re-accessing.`
      };
    }

    this._cooldowns.set(key, now);
    return { allowed: true, waitMs: 0, message: 'OK' };
  }

  /**
   * Cleanup expired entries (call periodically).
   */
  cleanup(maxAgeMs = 600000) {
    const now = Date.now();
    for (const [key, entries] of this._windows) {
      const valid = entries.filter(ts => (now - ts) < maxAgeMs);
      if (valid.length === 0) this._windows.delete(key);
      else this._windows.set(key, valid);
    }
    for (const [key, ts] of this._cooldowns) {
      if ((now - ts) > maxAgeMs) this._cooldowns.delete(key);
    }
  }
}

// Singleton instance
const limiter = new RateLimiter();

// Periodic cleanup every 10 minutes
setInterval(() => limiter.cleanup(), 10 * 60 * 1000);

/**
 * Express middleware factory.
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Window in ms (default 5 min)
 */
function rateLimitMiddleware(maxRequests = 10, windowMs = 5 * 60 * 1000) {
  return (req, res, next) => {
    const key = `${req.user?._id || req.ip}:${req.path}`;
    const result = limiter.check(key, maxRequests, windowMs);

    res.set('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      return res.status(429).json({
        error: result.message,
        retryAfterMs: result.retryAfterMs
      });
    }

    next();
  };
}

module.exports = { rateLimitMiddleware, limiter };
