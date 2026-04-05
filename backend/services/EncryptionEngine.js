/**
 * Encryption Engine — Strategy Design Pattern with 6 Encryption Algorithms.
 *
 * Implements the Strategy pattern: each encryption method is a separate class
 * implementing a common interface. The StrategyFactory selects the appropriate
 * strategy at runtime based on context. New algorithms can be added by creating
 * a new class and registering it — zero changes to core logic.
 *
 * Strategies:
 *   BASIC    -> AES-128-CBC         (low-risk contexts)
 *   STANDARD -> AES-192-CBC         (medium-risk contexts)
 *   STRONG   -> AES-256-GCM         (high-risk, authenticated)
 *   CHACHA   -> ChaCha20-Poly1305   (mobile/streaming optimized)
 *   ADVANCED -> AES-256-CBC         (large file encryption)
 *   LEGACY   -> Triple-DES          (backward compatibility)
 *
 * Keys are wrapped using AES-256-GCM with a master key (key wrapping / envelope encryption).
 */

const crypto = require('crypto');

// ─── Base Strategy Interface ────────────────────────────────────────
class EncryptionStrategy {
  constructor(name, algorithm, keyLength, ivLength, useAuthTag) {
    if (new.target === EncryptionStrategy) {
      throw new Error('Cannot instantiate abstract EncryptionStrategy');
    }
    this.name = name;
    this.algorithm = algorithm;
    this.keyLength = keyLength;
    this.ivLength = ivLength;
    this.useAuthTag = useAuthTag;
  }

  /** @returns {{ encryptedData, iv, authTag, dataKey, algorithm, strategy }} */
  encrypt(plaintext) {
    const dataKey = crypto.randomBytes(this.keyLength);
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, dataKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: this.useAuthTag ? cipher.getAuthTag().toString('hex') : null,
      dataKey: dataKey.toString('hex'),
      algorithm: this.algorithm,
      strategy: this.name
    };
  }

  /** @returns {string} decrypted plaintext */
  decrypt(encryptedData, dataKeyHex, ivHex, authTagHex) {
    const dataKey = Buffer.from(dataKeyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, dataKey, iv);

    if (this.useAuthTag && authTagHex) {
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    }

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  getConfig() {
    return {
      name: this.name,
      algorithm: this.algorithm,
      keyLength: this.keyLength * 8 + '-bit',
      useAuthTag: this.useAuthTag
    };
  }
}

// ─── Concrete Strategy Implementations ──────────────────────────────

class BasicStrategy extends EncryptionStrategy {
  constructor() { super('BASIC', 'aes-128-cbc', 16, 16, false); }
}

class StandardStrategy extends EncryptionStrategy {
  constructor() { super('STANDARD', 'aes-192-cbc', 24, 16, false); }
}

class StrongStrategy extends EncryptionStrategy {
  constructor() { super('STRONG', 'aes-256-gcm', 32, 16, true); }
}

class ChaChaStrategy extends EncryptionStrategy {
  constructor() { super('CHACHA', 'chacha20-poly1305', 32, 12, true); }
}

class AdvancedStrategy extends EncryptionStrategy {
  constructor() { super('ADVANCED', 'aes-256-cbc', 32, 16, false); }
}

class LegacyStrategy extends EncryptionStrategy {
  constructor() { super('LEGACY', 'des-ede3-cbc', 24, 8, false); }
}

// ─── Strategy Factory (Registry pattern) ────────────────────────────

class StrategyFactory {
  constructor() {
    this._strategies = new Map();
  }

  register(name, StrategyClass) {
    this._strategies.set(name, new StrategyClass());
  }

  get(name) {
    const strategy = this._strategies.get(name);
    if (!strategy) {
      console.warn(`Unknown strategy "${name}", falling back to STANDARD`);
      return this._strategies.get('STANDARD');
    }
    return strategy;
  }

  listAll() {
    return Array.from(this._strategies.entries()).map(([name, s]) => s.getConfig());
  }
}

// ─── Singleton factory with registered strategies ───────────────────
const factory = new StrategyFactory();
factory.register('BASIC', BasicStrategy);
factory.register('STANDARD', StandardStrategy);
factory.register('STRONG', StrongStrategy);
factory.register('CHACHA', ChaChaStrategy);
factory.register('ADVANCED', AdvancedStrategy);
factory.register('LEGACY', LegacyStrategy);

// ─── Main Engine (Facade) ───────────────────────────────────────────

class EncryptionEngine {
  /**
   * Get algorithm config for display/logging.
   */
  static getAlgorithmConfig(strategyName) {
    return factory.get(strategyName).getConfig();
  }

  /**
   * List all available encryption strategies.
   */
  static listStrategies() {
    return factory.listAll();
  }

  /**
   * Encrypt data using the named strategy.
   * @param {string} plaintext - Data to encrypt
   * @param {string} strategyName - BASIC, STANDARD, STRONG, CHACHA, ADVANCED, LEGACY
   * @returns {Object}
   */
  static encrypt(plaintext, strategyName) {
    const strategy = factory.get(strategyName);
    return strategy.encrypt(plaintext);
  }

  /**
   * Decrypt data using the named strategy.
   * @param {string} encryptedData - Hex-encoded ciphertext
   * @param {string} dataKeyHex - Hex-encoded data encryption key
   * @param {string} ivHex - Hex-encoded IV
   * @param {string} strategyName - Strategy name
   * @param {string|null} authTagHex - Auth tag for authenticated modes
   * @returns {string}
   */
  static decrypt(encryptedData, dataKeyHex, ivHex, strategyName, authTagHex = null) {
    const strategy = factory.get(strategyName);
    return strategy.decrypt(encryptedData, dataKeyHex, ivHex, authTagHex);
  }

  /**
   * Wrap (encrypt) a data key using the master key — envelope encryption.
   */
  static wrapKey(dataKeyHex, masterKeyHex) {
    const masterKey = Buffer.from(masterKeyHex, 'hex').slice(0, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    let wrapped = cipher.update(dataKeyHex, 'utf8', 'hex');
    wrapped += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedKey: wrapped,
      keyIv: iv.toString('hex'),
      keyAuthTag: authTag
    };
  }

  /**
   * Unwrap (decrypt) a data key using the master key.
   */
  static unwrapKey(encryptedKeyHex, keyIvHex, keyAuthTagHex, masterKeyHex) {
    const masterKey = Buffer.from(masterKeyHex, 'hex').slice(0, 32);
    const iv = Buffer.from(keyIvHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(Buffer.from(keyAuthTagHex, 'hex'));

    let unwrapped = decipher.update(encryptedKeyHex, 'hex', 'utf8');
    unwrapped += decipher.final('utf8');

    return unwrapped;
  }

  /**
   * Compute SHA-256 checksum for data integrity verification.
   */
  static computeChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify checksum matches.
   */
  static verifyChecksum(data, expectedChecksum) {
    const computed = EncryptionEngine.computeChecksum(data);
    return computed === expectedChecksum;
  }

  /**
   * Register a new strategy at runtime (extensibility).
   */
  static registerStrategy(name, StrategyClass) {
    factory.register(name, StrategyClass);
  }
}

module.exports = EncryptionEngine;
module.exports.EncryptionStrategy = EncryptionStrategy;
