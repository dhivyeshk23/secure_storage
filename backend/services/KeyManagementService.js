/**
 * Key Management Service — Singleton Pattern.
 *
 * Handles secure key generation, storage tracking, and rotation scheduling.
 * Implements separation of concerns between encryption operations and key lifecycle.
 */

const crypto = require('crypto');
const EncryptionKey = require('../models/EncryptionKey');
const EncryptionEngine = require('./EncryptionEngine');

class KeyManagementService {
  constructor() {
    if (KeyManagementService._instance) {
      return KeyManagementService._instance;
    }

    this._rotationIntervalDays = 90; // Rotate keys every 90 days
    this._keyGenerationCount = 0;
    this._lastRotationCheck = null;
    KeyManagementService._instance = this;
  }

  /**
   * Generate a secure random key of specified byte length.
   */
  generateKey(byteLength = 32) {
    this._keyGenerationCount++;
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * Generate a master-key-grade secret.
   */
  generateMasterKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Wrap a data key using envelope encryption with the master key.
   */
  wrapDataKey(dataKeyHex, masterKeyHex) {
    return EncryptionEngine.wrapKey(dataKeyHex, masterKeyHex);
  }

  /**
   * Unwrap a data key.
   */
  unwrapDataKey(encryptedKeyHex, keyIvHex, keyAuthTagHex, masterKeyHex) {
    return EncryptionEngine.unwrapKey(encryptedKeyHex, keyIvHex, keyAuthTagHex, masterKeyHex);
  }

  /**
   * Check if keys are due for rotation based on age.
   * @returns {Object} { dueForRotation: boolean, oldestKeyAge: number, rotationIntervalDays: number }
   */
  async checkRotationStatus() {
    this._lastRotationCheck = new Date();

    const oldestKey = await EncryptionKey.findOne().sort({ createdAt: 1 });
    if (!oldestKey) {
      return {
        dueForRotation: false,
        oldestKeyAgeDays: 0,
        rotationIntervalDays: this._rotationIntervalDays,
        totalKeys: 0,
        message: 'No encryption keys found.'
      };
    }

    const ageMs = Date.now() - new Date(oldestKey.createdAt).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const totalKeys = await EncryptionKey.countDocuments();

    return {
      dueForRotation: ageDays >= this._rotationIntervalDays,
      oldestKeyAgeDays: ageDays,
      rotationIntervalDays: this._rotationIntervalDays,
      totalKeys,
      lastChecked: this._lastRotationCheck.toISOString(),
      generatedKeysThisSession: this._keyGenerationCount,
      message: ageDays >= this._rotationIntervalDays
        ? `Key rotation recommended: oldest key is ${ageDays} days old.`
        : `Keys are within rotation period. Oldest: ${ageDays} days.`
    };
  }

  /**
   * Rotate a specific vault item's encryption key.
   * Re-wraps the data key with a new random key under the master key.
   */
  async rotateKeyForItem(vaultItemId, masterKeyHex) {
    const keyDoc = await EncryptionKey.findOne({ vaultItem: vaultItemId });
    if (!keyDoc) {
      throw new Error('Encryption key not found for this vault item.');
    }

    // Unwrap the current data key
    const currentDataKey = this.unwrapDataKey(
      keyDoc.encryptedKey,
      keyDoc.keyIv,
      keyDoc.keyAuthTag,
      masterKeyHex
    );

    // Re-wrap with new IV (effectively a key rotation at the wrapping level)
    const newWrapped = this.wrapDataKey(currentDataKey, masterKeyHex);

    keyDoc.encryptedKey = newWrapped.encryptedKey;
    keyDoc.keyIv = newWrapped.keyIv;
    keyDoc.keyAuthTag = newWrapped.keyAuthTag;
    keyDoc.createdAt = new Date(); // Reset age
    await keyDoc.save();

    return { rotated: true, vaultItemId, rotatedAt: new Date().toISOString() };
  }

  /**
   * Bulk rotate all keys that exceed the rotation interval.
   */
  async rotateExpiredKeys(masterKeyHex) {
    const cutoff = new Date(Date.now() - this._rotationIntervalDays * 24 * 60 * 60 * 1000);
    const expiredKeys = await EncryptionKey.find({ createdAt: { $lte: cutoff } });

    const results = { rotated: 0, failed: 0, errors: [] };

    for (const keyDoc of expiredKeys) {
      try {
        await this.rotateKeyForItem(keyDoc.vaultItem, masterKeyHex);
        results.rotated++;
      } catch (err) {
        results.failed++;
        results.errors.push({ vaultItem: keyDoc.vaultItem, error: err.message });
      }
    }

    return results;
  }

  /**
   * Get service status (for admin dashboard).
   */
  getStatus() {
    return {
      rotationIntervalDays: this._rotationIntervalDays,
      generatedKeysThisSession: this._keyGenerationCount,
      lastRotationCheck: this._lastRotationCheck?.toISOString() || 'never',
      instanceId: 'singleton'
    };
  }
}

// Export singleton instance
module.exports = new KeyManagementService();
