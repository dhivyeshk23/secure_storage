const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const VaultItem = require('../models/VaultItem');
const EncryptionKey = require('../models/EncryptionKey');
const Alert = require('../models/Alert');
const EncryptionEngine = require('../services/EncryptionEngine');
const PolicyEngine = require('../services/PolicyEngine');
const AuditService = require('../services/AuditService');
const { authenticate } = require('../middleware/auth');
const { rateLimitMiddleware, limiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ─── File Upload Config ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ─── MIME Type → Category Mapping ───────────────────────────────────
const MIME_CATEGORIES = {
  // Images
  'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image',
  'image/webp': 'image', 'image/svg+xml': 'image', 'image/bmp': 'image',
  'image/tiff': 'image',
  // Audio
  'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio',
  'audio/flac': 'audio', 'audio/aac': 'audio', 'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  // Video
  'video/mp4': 'video', 'video/webm': 'video', 'video/x-msvideo': 'video',
  'video/quicktime': 'video', 'video/x-matroska': 'video',
  // Documents
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/rtf': 'document',
  // Spreadsheets
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'text/csv': 'spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
  // Archives
  'application/zip': 'archive', 'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive', 'application/x-tar': 'archive',
  'application/gzip': 'archive'
};

function categorizeFile(mimeType) {
  return MIME_CATEGORIES[mimeType] || 'other';
}

function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  if (/Mobile|Android|iPhone/i.test(userAgent)) return 'mobile';
  if (/Tablet|iPad/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

// ─── POST /api/vault/store — Store text data ────────────────────────
router.post('/store', authenticate, async (req, res) => {
  try {
    const { title, data, sensitivityLevel } = req.body;
    const user = req.user;
    const deviceType = getDeviceType(req.headers['user-agent']);

    if (!title || !data || !sensitivityLevel) {
      return res.status(400).json({ error: 'Title, data, and sensitivityLevel are required.' });
    }
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(sensitivityLevel)) {
      return res.status(400).json({ error: 'sensitivityLevel must be LOW, MEDIUM, HIGH, or CRITICAL.' });
    }

    const accessCheck = PolicyEngine.checkAccess(user.role, sensitivityLevel);
    if (!accessCheck.granted) {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'ACCESS_DENIED', resource: title, details: accessCheck.message,
        context: { sensitivityLevel, location: user.location }, success: false
      });
      return res.status(403).json({ error: accessCheck.message });
    }

    const context = {
      role: user.role, sensitivityLevel, location: user.location,
      timestamp: new Date().toISOString(), deviceType
    };
    const policyResult = PolicyEngine.evaluate(context);

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'POLICY_EVALUATED', resource: title,
      details: `Score: ${policyResult.score}, Strategy: ${policyResult.strategy}, Risk: ${policyResult.riskLevel}`,
      context: { sensitivityLevel, location: user.location, encryptionStrategy: policyResult.strategy }
    });

    const checksum = EncryptionEngine.computeChecksum(data);
    const encryptionResult = EncryptionEngine.encrypt(data, policyResult.strategy);
    const wrappedKey = EncryptionEngine.wrapKey(encryptionResult.dataKey, process.env.MASTER_ENCRYPTION_KEY);

    const vaultItem = new VaultItem({
      owner: user._id, title, sensitivityLevel, fileType: 'text',
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv, authTag: encryptionResult.authTag,
      encryptionStrategy: policyResult.strategy,
      algorithm: encryptionResult.algorithm, checksum,
      metadata: {
        originalSize: Buffer.byteLength(data, 'utf8'),
        encryptedAt: new Date(),
        contextSnapshot: {
          role: user.role, location: user.location,
          timeOfAccess: context.timestamp, sensitivityLevel, deviceType,
          policyDecision: `${policyResult.strategy} (score: ${policyResult.score})`
        }
      }
    });
    await vaultItem.save();

    const encryptionKeyDoc = new EncryptionKey({
      vaultItem: vaultItem._id, owner: user._id,
      encryptedKey: wrappedKey.encryptedKey,
      keyIv: wrappedKey.keyIv, keyAuthTag: wrappedKey.keyAuthTag,
      algorithm: encryptionResult.algorithm
    });
    await encryptionKeyDoc.save();

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'STORE_DATA', resource: title,
      details: `Text stored with ${policyResult.strategy} encryption (${encryptionResult.algorithm})`,
      context: { sensitivityLevel, encryptionStrategy: policyResult.strategy }
    });

    res.status(201).json({
      message: 'Data stored securely',
      vaultItem: {
        id: vaultItem._id, title: vaultItem.title, sensitivityLevel,
        fileType: 'text', encryptionStrategy: policyResult.strategy,
        algorithm: encryptionResult.algorithm,
        policyEvaluation: { score: policyResult.score, reasons: policyResult.reasons, riskLevel: policyResult.riskLevel },
        storedAt: vaultItem.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store data: ' + error.message });
  }
});

// ─── POST /api/vault/store/file — Universal file upload ─────────────
router.post('/store/file', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { title, sensitivityLevel } = req.body;
    const user = req.user;
    const file = req.file;
    const deviceType = getDeviceType(req.headers['user-agent']);

    if (!file) return res.status(400).json({ error: 'File is required.' });
    if (!title || !sensitivityLevel) {
      return res.status(400).json({ error: 'Title and sensitivityLevel are required.' });
    }
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(sensitivityLevel)) {
      return res.status(400).json({ error: 'sensitivityLevel must be LOW, MEDIUM, HIGH, or CRITICAL.' });
    }

    const accessCheck = PolicyEngine.checkAccess(user.role, sensitivityLevel);
    if (!accessCheck.granted) {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'ACCESS_DENIED', resource: title, details: accessCheck.message,
        context: { sensitivityLevel, location: user.location }, success: false
      });
      return res.status(403).json({ error: accessCheck.message });
    }

    const fileCategory = categorizeFile(file.mimetype);
    const context = {
      role: user.role, sensitivityLevel, location: user.location,
      timestamp: new Date().toISOString(), deviceType
    };
    const policyResult = PolicyEngine.evaluate(context);

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'POLICY_EVALUATED', resource: title,
      details: `File: ${file.originalname} (${fileCategory}), Score: ${policyResult.score}, Strategy: ${policyResult.strategy}`,
      context: { sensitivityLevel, location: user.location, encryptionStrategy: policyResult.strategy }
    });

    // Convert file buffer to base64 for encryption
    const fileBase64 = file.buffer.toString('base64');
    const checksum = EncryptionEngine.computeChecksum(fileBase64);
    const encryptionResult = EncryptionEngine.encrypt(fileBase64, policyResult.strategy);
    const wrappedKey = EncryptionEngine.wrapKey(encryptionResult.dataKey, process.env.MASTER_ENCRYPTION_KEY);

    const vaultItem = new VaultItem({
      owner: user._id, title, sensitivityLevel,
      fileType: fileCategory, originalFileName: file.originalname,
      mimeType: file.mimetype,
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv, authTag: encryptionResult.authTag,
      encryptionStrategy: policyResult.strategy,
      algorithm: encryptionResult.algorithm, checksum,
      metadata: {
        originalSize: file.size, mimeType: file.mimetype,
        encryptedAt: new Date(),
        contextSnapshot: {
          role: user.role, location: user.location,
          timeOfAccess: context.timestamp, sensitivityLevel, deviceType,
          policyDecision: `${policyResult.strategy} (score: ${policyResult.score})`
        }
      }
    });
    await vaultItem.save();

    const encryptionKeyDoc = new EncryptionKey({
      vaultItem: vaultItem._id, owner: user._id,
      encryptedKey: wrappedKey.encryptedKey,
      keyIv: wrappedKey.keyIv, keyAuthTag: wrappedKey.keyAuthTag,
      algorithm: encryptionResult.algorithm
    });
    await encryptionKeyDoc.save();

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'STORE_DATA', resource: title,
      details: `${fileCategory.toUpperCase()} file "${file.originalname}" (${(file.size / 1024).toFixed(1)}KB) stored with ${policyResult.strategy}`,
      context: { sensitivityLevel, encryptionStrategy: policyResult.strategy }
    });

    res.status(201).json({
      message: `${fileCategory.toUpperCase()} file stored securely`,
      vaultItem: {
        id: vaultItem._id, title, originalFileName: file.originalname,
        sensitivityLevel, fileType: fileCategory, mimeType: file.mimetype,
        encryptionStrategy: policyResult.strategy, algorithm: encryptionResult.algorithm,
        policyEvaluation: { score: policyResult.score, reasons: policyResult.reasons, riskLevel: policyResult.riskLevel },
        fileSize: file.size, storedAt: vaultItem.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store file: ' + error.message });
  }
});

// ─── Backward-compatible PDF endpoint ───────────────────────────────
router.post('/store/pdf', authenticate, upload.single('file'), async (req, res) => {
  // Redirect to universal file handler
  req.body.sensitivityLevel = req.body.sensitivityLevel || 'MEDIUM';
  req.body.title = req.body.title || req.file?.originalname || 'Uploaded PDF';
  
  // Directly call next handler
  try {
    const { title, sensitivityLevel } = req.body;
    const user = req.user;
    const file = req.file;
    const deviceType = getDeviceType(req.headers['user-agent']);

    if (!file) return res.status(400).json({ error: 'PDF file is required.' });
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed on this endpoint. Use /store/file for other formats.' });
    }

    const accessCheck = PolicyEngine.checkAccess(user.role, sensitivityLevel);
    if (!accessCheck.granted) {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'ACCESS_DENIED', resource: title, details: accessCheck.message,
        context: { sensitivityLevel, location: user.location }, success: false
      });
      return res.status(403).json({ error: accessCheck.message });
    }

    const context = { role: user.role, sensitivityLevel, location: user.location, timestamp: new Date().toISOString(), deviceType };
    const policyResult = PolicyEngine.evaluate(context);
    const fileBase64 = file.buffer.toString('base64');
    const checksum = EncryptionEngine.computeChecksum(fileBase64);
    const encryptionResult = EncryptionEngine.encrypt(fileBase64, policyResult.strategy);
    const wrappedKey = EncryptionEngine.wrapKey(encryptionResult.dataKey, process.env.MASTER_ENCRYPTION_KEY);

    const vaultItem = new VaultItem({
      owner: user._id, title, sensitivityLevel, fileType: 'pdf',
      originalFileName: file.originalname, mimeType: file.mimetype,
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv, authTag: encryptionResult.authTag,
      encryptionStrategy: policyResult.strategy, algorithm: encryptionResult.algorithm,
      checksum,
      metadata: {
        originalSize: file.size, mimeType: file.mimetype, encryptedAt: new Date(),
        contextSnapshot: { role: user.role, location: user.location, timeOfAccess: context.timestamp, sensitivityLevel, deviceType, policyDecision: `${policyResult.strategy} (score: ${policyResult.score})` }
      }
    });
    await vaultItem.save();

    const encryptionKeyDoc = new EncryptionKey({
      vaultItem: vaultItem._id, owner: user._id,
      encryptedKey: wrappedKey.encryptedKey, keyIv: wrappedKey.keyIv,
      keyAuthTag: wrappedKey.keyAuthTag, algorithm: encryptionResult.algorithm
    });
    await encryptionKeyDoc.save();

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'STORE_DATA', resource: title,
      details: `PDF "${file.originalname}" stored with ${policyResult.strategy}`,
      context: { sensitivityLevel, encryptionStrategy: policyResult.strategy }
    });

    res.status(201).json({
      message: 'PDF file stored securely',
      vaultItem: {
        id: vaultItem._id, title, originalFileName: file.originalname,
        sensitivityLevel, fileType: 'pdf',
        encryptionStrategy: policyResult.strategy, algorithm: encryptionResult.algorithm,
        policyEvaluation: { score: policyResult.score, reasons: policyResult.reasons },
        storedAt: vaultItem.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store PDF: ' + error.message });
  }
});

// ─── GET /api/vault/retrieve/:id — Retrieve & decrypt ───────────────
router.get('/retrieve/:id', authenticate, rateLimitMiddleware(15, 5 * 60 * 1000), async (req, res) => {
  try {
    const user = req.user;
    const vaultItem = await VaultItem.findById(req.params.id);

    if (!vaultItem) return res.status(404).json({ error: 'Vault item not found.' });

    // Ownership check
    if (vaultItem.owner.toString() !== user._id.toString() && user.role !== 'admin') {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'ACCESS_DENIED', resource: vaultItem.title,
        details: 'Attempted to access another user\'s data', success: false
      });
      return res.status(403).json({ error: 'Access denied. You can only access your own data.' });
    }

    // Access level check
    const accessCheck = PolicyEngine.checkAccess(user.role, vaultItem.sensitivityLevel);
    if (!accessCheck.granted) {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'ACCESS_DENIED', resource: vaultItem.title,
        details: accessCheck.message,
        context: { sensitivityLevel: vaultItem.sensitivityLevel }, success: false
      });
      return res.status(403).json({ error: accessCheck.message });
    }

    // CRITICAL data re-authentication
    if (PolicyEngine.requiresReAuthentication(vaultItem.sensitivityLevel)) {
      const { password } = req.query;
      if (!password) {
        return res.status(428).json({
          error: 'CRITICAL data requires password re-confirmation.',
          requiresReAuth: true
        });
      }
      const User = require('../models/User');
      const fullUser = await User.findById(user._id);
      const isValid = await fullUser.comparePassword(password);
      if (!isValid) {
        await AuditService.log({
          userId: user._id, username: user.username, role: user.role,
          action: 'ACCESS_DENIED', resource: vaultItem.title,
          details: 'Password re-confirmation failed for CRITICAL data', success: false
        });

        // Create alert for failed critical access
        const alert = new Alert({
          user: user._id, type: 'critical_access',
          title: 'Failed CRITICAL Data Access',
          message: `Failed password re-confirmation for "${vaultItem.title}"`,
          severity: 'high'
        });
        await alert.save();

        return res.status(403).json({ error: 'Password re-confirmation failed.' });
      }
    }

    // Access cooldown (30 seconds between same-item decryptions)
    const cooldownKey = `${user._id}:${vaultItem._id}`;
    const cooldownCheck = limiter.checkCooldown(cooldownKey, 30000);
    if (!cooldownCheck.allowed) {
      return res.status(429).json({ error: cooldownCheck.message });
    }

    // Decrypt
    const keyDoc = await EncryptionKey.findOne({ vaultItem: vaultItem._id });
    if (!keyDoc) {
      return res.status(500).json({ error: 'Encryption key not found. Data cannot be decrypted.' });
    }

    const dataKeyHex = EncryptionEngine.unwrapKey(
      keyDoc.encryptedKey, keyDoc.keyIv, keyDoc.keyAuthTag,
      process.env.MASTER_ENCRYPTION_KEY
    );

    const decryptedData = EncryptionEngine.decrypt(
      vaultItem.encryptedData, dataKeyHex, vaultItem.iv,
      vaultItem.encryptionStrategy, vaultItem.authTag
    );

    // Integrity check
    if (vaultItem.checksum) {
      const isValid = EncryptionEngine.verifyChecksum(decryptedData, vaultItem.checksum);
      if (!isValid) {
        const alert = new Alert({
          user: user._id, type: 'integrity_violation',
          title: 'Data Integrity Violation',
          message: `Checksum mismatch on "${vaultItem.title}" — data may be corrupted or tampered with.`,
          severity: 'critical'
        });
        await alert.save();

        await AuditService.log({
          userId: user._id, username: user.username, role: user.role,
          action: 'INTEGRITY_VIOLATION', resource: vaultItem.title,
          details: 'Checksum mismatch detected during decryption', success: false
        });

        return res.status(500).json({ error: 'Data integrity check failed. The data may have been corrupted or tampered with.' });
      }
    }

    // Update access tracking
    vaultItem.accessCount = (vaultItem.accessCount || 0) + 1;
    vaultItem.lastAccessedAt = new Date();
    await vaultItem.save();

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'RETRIEVE_DATA', resource: vaultItem.title,
      details: `${vaultItem.fileType} data decrypted (access #${vaultItem.accessCount})`,
      context: { sensitivityLevel: vaultItem.sensitivityLevel, encryptionStrategy: vaultItem.encryptionStrategy }
    });

    // Return based on file type
    if (vaultItem.fileType !== 'text') {
      const fileBuffer = Buffer.from(decryptedData, 'base64');
      const contentType = vaultItem.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${vaultItem.originalFileName || 'download'}"`);
      return res.send(fileBuffer);
    }

    res.json({
      message: 'Data retrieved and decrypted successfully',
      vaultItem: {
        id: vaultItem._id, title: vaultItem.title,
        sensitivityLevel: vaultItem.sensitivityLevel,
        fileType: vaultItem.fileType,
        encryptionStrategy: vaultItem.encryptionStrategy,
        algorithm: vaultItem.algorithm,
        data: decryptedData,
        metadata: vaultItem.metadata,
        accessCount: vaultItem.accessCount,
        storedAt: vaultItem.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve data: ' + error.message });
  }
});

// ─── GET /api/vault/view-encrypted/:id — View ciphertext ────────────
router.get('/view-encrypted/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const vaultItem = await VaultItem.findById(req.params.id);

    if (!vaultItem) return res.status(404).json({ error: 'Vault item not found.' });

    if (vaultItem.owner.toString() !== user._id.toString() && user.role !== 'admin') {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'ACCESS_DENIED', resource: vaultItem.title,
        details: 'Attempted to view encrypted data of another user', success: false
      });
      return res.status(403).json({ error: 'Access denied.' });
    }

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'VIEW_ENCRYPTED', resource: vaultItem.title,
      details: `Viewed encrypted ${vaultItem.fileType} data without decryption`,
      context: { sensitivityLevel: vaultItem.sensitivityLevel, encryptionStrategy: vaultItem.encryptionStrategy }
    });

    res.json({
      message: 'Encrypted data retrieved (not decrypted)',
      vaultItem: {
        id: vaultItem._id, title: vaultItem.title,
        fileType: vaultItem.fileType, originalFileName: vaultItem.originalFileName,
        mimeType: vaultItem.mimeType,
        sensitivityLevel: vaultItem.sensitivityLevel,
        encryptionStrategy: vaultItem.encryptionStrategy,
        algorithm: vaultItem.algorithm,
        encryptedData: vaultItem.encryptedData,
        iv: vaultItem.iv, authTag: vaultItem.authTag,
        checksum: vaultItem.checksum,
        metadata: {
          originalSize: vaultItem.metadata?.originalSize,
          mimeType: vaultItem.metadata?.mimeType,
          encryptedAt: vaultItem.metadata?.encryptedAt
        },
        storedAt: vaultItem.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to view encrypted data: ' + error.message });
  }
});

// ─── GET /api/vault/items — List all vault items ────────────────────
router.get('/items', authenticate, async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    if (user.role !== 'admin') {
      query.owner = user._id;
    }

    const items = await VaultItem.find(query)
      .select('-encryptedData -iv -authTag -checksum')
      .populate('owner', 'username role')
      .populate('folder', 'name color')
      .sort({ createdAt: -1 });

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'RETRIEVE_ALL', details: `Listed ${items.length} vault items`,
      context: { location: user.location }
    });

    res.json({ count: items.length, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list items: ' + error.message });
  }
});

// ─── DELETE /api/vault/delete/:id — Delete a vault item ─────────────
router.delete('/delete/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const vaultItem = await VaultItem.findById(req.params.id);

    if (!vaultItem) return res.status(404).json({ error: 'Vault item not found.' });

    if (vaultItem.owner.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only the owner or admin can delete.' });
    }

    await EncryptionKey.deleteOne({ vaultItem: vaultItem._id });
    await VaultItem.findByIdAndDelete(req.params.id);

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'DELETE_DATA', resource: vaultItem.title,
      details: `${vaultItem.fileType} vault item and encryption key deleted`,
      context: { sensitivityLevel: vaultItem.sensitivityLevel }
    });

    res.json({ message: 'Vault item deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete: ' + error.message });
  }
});

module.exports = router;
