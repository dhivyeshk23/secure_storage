const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const ShareLink = require('../models/ShareLink');
const VaultItem = require('../models/VaultItem');
const EncryptionKey = require('../models/EncryptionKey');
const EncryptionEngine = require('../services/EncryptionEngine');
const AuditService = require('../services/AuditService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Expiry Presets (ms) ────────────────────────────────────────────
const EXPIRY_PRESETS = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
};

// ─── POST /api/vault/share — Create a share link ────────────────────
router.post('/vault/share', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { itemId, expiresIn, maxDownloads, password, label } = req.body;

    if (!itemId || !expiresIn) {
      return res.status(400).json({ error: 'itemId and expiresIn are required.' });
    }

    // Find the vault item
    const vaultItem = await VaultItem.findById(itemId);
    if (!vaultItem) {
      return res.status(404).json({ error: 'Vault item not found.' });
    }

    // Ownership check
    if (vaultItem.owner.toString() !== user._id.toString() && user.role !== 'admin') {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'SHARE_DENIED', resource: vaultItem.title,
        details: 'Attempted to share another user\'s data', success: false
      });
      return res.status(403).json({ error: 'Access denied. You can only share your own files.' });
    }

    // Sensitivity restrictions
    if (vaultItem.sensitivityLevel === 'CRITICAL') {
      await AuditService.log({
        userId: user._id, username: user.username, role: user.role,
        action: 'SHARE_DENIED', resource: vaultItem.title,
        details: 'CRITICAL sensitivity files cannot be shared', success: false
      });
      return res.status(403).json({
        error: 'CRITICAL sensitivity files cannot be shared for security reasons.'
      });
    }

    if (vaultItem.sensitivityLevel === 'HIGH' && !password) {
      return res.status(400).json({
        error: 'HIGH sensitivity files require a password to be set on the share link.',
        requiresPassword: true
      });
    }

    // Calculate expiry
    let expiryMs;
    if (EXPIRY_PRESETS[expiresIn]) {
      expiryMs = EXPIRY_PRESETS[expiresIn];
    } else {
      // Custom: expect milliseconds
      expiryMs = parseInt(expiresIn);
      if (isNaN(expiryMs) || expiryMs < 60000 || expiryMs > 30 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({
          error: 'Invalid expiresIn. Use a preset (15m, 1h, 6h, 24h, 7d, 30d) or milliseconds (min: 60000, max: 30 days).'
        });
      }
    }

    const expiresAt = new Date(Date.now() + expiryMs);

    // Generate crypto-random token
    const token = crypto.randomBytes(48).toString('hex');

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const shareLink = new ShareLink({
      token,
      vaultItem: vaultItem._id,
      createdBy: user._id,
      expiresAt,
      maxDownloads: maxDownloads || 0,
      password: hashedPassword,
      label: label || `Share of "${vaultItem.title}"`
    });

    await shareLink.save();

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'SHARE_CREATED', resource: vaultItem.title,
      details: `Share link created — expires: ${expiresAt.toISOString()}, max downloads: ${maxDownloads || 'unlimited'}, password: ${password ? 'yes' : 'no'}`,
      context: { sensitivityLevel: vaultItem.sensitivityLevel }
    });

    res.status(201).json({
      message: 'Share link created successfully',
      shareLink: {
        id: shareLink._id,
        token: shareLink.token,
        expiresAt: shareLink.expiresAt,
        maxDownloads: shareLink.maxDownloads,
        hasPassword: !!password,
        label: shareLink.label,
        createdAt: shareLink.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create share link: ' + error.message });
  }
});

// ─── GET /api/vault/shares/:itemId — List share links for an item ───
router.get('/vault/shares/:itemId', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const vaultItem = await VaultItem.findById(req.params.itemId);

    if (!vaultItem) return res.status(404).json({ error: 'Vault item not found.' });

    if (vaultItem.owner.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const links = await ShareLink.find({
      vaultItem: vaultItem._id,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json({
      count: links.length,
      links: links.map(link => ({
        id: link._id,
        token: link.token,
        label: link.label,
        expiresAt: link.expiresAt,
        maxDownloads: link.maxDownloads,
        downloadCount: link.downloadCount,
        hasPassword: !!link.password,
        isActive: link.isActive,
        lastDownloadedAt: link.lastDownloadedAt,
        createdAt: link.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list share links: ' + error.message });
  }
});

// ─── GET /api/vault/shares — List ALL share links for current user ──
router.get('/vault/shares', authenticate, async (req, res) => {
  try {
    const user = req.user;

    let query = { createdBy: user._id };
    if (user.role === 'admin') {
      query = {}; // Admins see all
    }

    const links = await ShareLink.find(query)
      .populate('vaultItem', 'title fileType originalFileName sensitivityLevel mimeType')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    // Separate into active and expired/revoked
    const now = new Date();
    const active = [];
    const expired = [];

    for (const link of links) {
      const entry = {
        id: link._id,
        token: link.token,
        label: link.label,
        vaultItem: link.vaultItem,
        createdBy: link.createdBy,
        expiresAt: link.expiresAt,
        maxDownloads: link.maxDownloads,
        downloadCount: link.downloadCount,
        hasPassword: !!link.password,
        isActive: link.isActive,
        lastDownloadedAt: link.lastDownloadedAt,
        createdAt: link.createdAt
      };

      if (link.isActive && link.expiresAt > now && (link.maxDownloads === 0 || link.downloadCount < link.maxDownloads)) {
        active.push(entry);
      } else {
        expired.push(entry);
      }
    }

    res.json({ active, expired, total: links.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list share links: ' + error.message });
  }
});

// ─── DELETE /api/vault/share/:linkId — Revoke a share link ──────────
router.delete('/vault/share/:linkId', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const link = await ShareLink.findById(req.params.linkId).populate('vaultItem', 'title');

    if (!link) return res.status(404).json({ error: 'Share link not found.' });

    if (link.createdBy.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    link.isActive = false;
    await link.save();

    await AuditService.log({
      userId: user._id, username: user.username, role: user.role,
      action: 'SHARE_REVOKED', resource: link.vaultItem?.title || 'Unknown',
      details: `Share link revoked (${link.downloadCount} downloads used)`,
      context: {}
    });

    res.json({ message: 'Share link revoked successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke share link: ' + error.message });
  }
});

// ─── GET /api/share/:token/info — Public: Get file info ─────────────
router.get('/share/:token/info', async (req, res) => {
  try {
    const link = await ShareLink.findOne({ token: req.params.token })
      .populate('vaultItem', 'title fileType originalFileName mimeType sensitivityLevel metadata')
      .populate('createdBy', 'username');

    if (!link) {
      return res.status(404).json({ error: 'Share link not found or has expired.' });
    }

    if (!link.isActive) {
      return res.status(410).json({ error: 'This share link has been revoked by the owner.' });
    }

    if (link.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This share link has expired.' });
    }

    if (link.maxDownloads > 0 && link.downloadCount >= link.maxDownloads) {
      return res.status(410).json({ error: 'This share link has reached its maximum download limit.' });
    }

    res.json({
      fileName: link.vaultItem?.originalFileName || link.vaultItem?.title || 'Shared File',
      fileType: link.vaultItem?.fileType || 'unknown',
      mimeType: link.vaultItem?.mimeType,
      fileSize: link.vaultItem?.metadata?.originalSize || null,
      sharedBy: link.createdBy?.username || 'Unknown',
      label: link.label,
      expiresAt: link.expiresAt,
      hasPassword: !!link.password,
      maxDownloads: link.maxDownloads,
      downloadCount: link.downloadCount,
      downloadsRemaining: link.maxDownloads > 0 ? link.maxDownloads - link.downloadCount : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get share info: ' + error.message });
  }
});

// ─── GET /api/share/:token — Public: Download shared file ───────────
router.get('/share/:token', async (req, res) => {
  try {
    const link = await ShareLink.findOne({ token: req.params.token })
      .populate('vaultItem')
      .populate('createdBy', 'username');

    if (!link) {
      return res.status(404).json({ error: 'Share link not found or has expired.' });
    }

    if (!link.isActive) {
      return res.status(410).json({ error: 'This share link has been revoked by the owner.' });
    }

    if (link.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This share link has expired.' });
    }

    if (link.maxDownloads > 0 && link.downloadCount >= link.maxDownloads) {
      return res.status(410).json({ error: 'This share link has reached its maximum download limit.' });
    }

    // Password check
    if (link.password) {
      const providedPassword = req.query.password || req.headers['x-share-password'];
      if (!providedPassword) {
        return res.status(401).json({
          error: 'This share link is password-protected.',
          requiresPassword: true
        });
      }
      const isValid = await bcrypt.compare(providedPassword, link.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
    }

    const vaultItem = link.vaultItem;
    if (!vaultItem) {
      return res.status(404).json({ error: 'The shared file no longer exists.' });
    }

    // Decrypt the file
    const keyDoc = await EncryptionKey.findOne({ vaultItem: vaultItem._id });
    if (!keyDoc) {
      return res.status(500).json({ error: 'Encryption key not found. File cannot be decrypted.' });
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
        return res.status(500).json({ error: 'Data integrity check failed.' });
      }
    }

    // Update download tracking
    link.downloadCount += 1;
    link.lastDownloadedAt = new Date();
    link.downloaderIPs.push({
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      downloadedAt: new Date()
    });
    await link.save();

    // Audit log
    await AuditService.log({
      userId: link.createdBy._id,
      username: link.createdBy.username,
      role: 'share-download',
      action: 'SHARE_DOWNLOADED',
      resource: vaultItem.title,
      details: `Download #${link.downloadCount} via share link (IP: ${req.ip || 'unknown'})`,
      context: { sensitivityLevel: vaultItem.sensitivityLevel, shareToken: link.token.substring(0, 8) + '...' }
    });

    // Return file
    if (vaultItem.fileType !== 'text') {
      const fileBuffer = Buffer.from(decryptedData, 'base64');
      const contentType = vaultItem.mimeType || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${vaultItem.originalFileName || 'download'}"`);
      return res.send(fileBuffer);
    }

    // Text data — return as JSON
    res.json({
      fileName: vaultItem.title,
      fileType: 'text',
      data: decryptedData
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to download shared file: ' + error.message });
  }
});

module.exports = router;
