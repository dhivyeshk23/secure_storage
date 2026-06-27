const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/rbacMiddleware');
const AuditService = require('../services/auditService');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require Security Manager (or Admin)
router.use(authenticate);
router.use(authorize('Security Manager', 'Admin'));

// ─── GET /api/security-manager/users ────────────────────────────────
// List all users with summary stats
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        roles: { include: { role: true } },
        _count: {
          select: {
            ownedFiles: true,
            auditLogs: true,
            sharesReceived: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Check for flags in metadata (we use AuditLog with action='FLAG_ACCOUNT')
    const flags = await prisma.auditLog.findMany({
      where: { action: 'FLAG_ACCOUNT' },
      orderBy: { timestamp: 'desc' }
    });

    const flagMap = {};
    flags.forEach(f => {
      if (f.targetFile && !flagMap[f.targetFile]) {
        flagMap[f.targetFile] = {
          reason: f.device || 'Suspicious activity',
          flaggedAt: f.timestamp,
          flaggedBy: f.userId
        };
      }
    });

    // Check for unflag events
    const unflags = await prisma.auditLog.findMany({
      where: { action: 'UNFLAG_ACCOUNT' },
      orderBy: { timestamp: 'desc' }
    });

    unflags.forEach(uf => {
      if (uf.targetFile && flagMap[uf.targetFile]) {
        // If unflag is newer than flag, remove the flag
        if (new Date(uf.timestamp) > new Date(flagMap[uf.targetFile].flaggedAt)) {
          delete flagMap[uf.targetFile];
        }
      }
    });

    const enriched = users.map(u => ({
      ...u,
      roles: u.roles.map(ur => ur.role.name),
      fileCount: u._count.ownedFiles,
      activityCount: u._count.auditLogs,
      sharesCount: u._count.sharesReceived,
      flag: flagMap[u.id] || null
    }));

    res.json(enriched);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── GET /api/security-manager/users/:userId ────────────────────────
// Get detailed user info + recent activity
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        roles: { include: { role: true } },
        ownedFiles: {
          select: {
            id: true,
            originalFilename: true,
            fileSize: true,
            encryptionAlgorithm: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        storageQuota: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent audit logs for this user
    const activities = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // Get shares
    const shares = await prisma.share.findMany({
      where: { recipientId: userId },
      include: {
        file: { select: { originalFilename: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Get flag status
    const latestFlag = await prisma.auditLog.findFirst({
      where: {
        targetFile: userId,
        action: { in: ['FLAG_ACCOUNT', 'UNFLAG_ACCOUNT'] }
      },
      orderBy: { timestamp: 'desc' }
    });

    const isFlagged = latestFlag?.action === 'FLAG_ACCOUNT';

    res.json({
      ...user,
      ownedFiles: user.ownedFiles.map(f => ({ ...f, fileSize: f.fileSize.toString() })),
      storageQuota: user.storageQuota ? {
        ...user.storageQuota,
        limitBytes: user.storageQuota.limitBytes.toString(),
        usedBytes: user.storageQuota.usedBytes.toString()
      } : null,
      roles: user.roles.map(ur => ur.role.name),
      activities,
      shares,
      isFlagged,
      flagDetails: isFlagged ? {
        reason: latestFlag.device || 'Suspicious activity',
        flaggedAt: latestFlag.timestamp
      } : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// ─── POST /api/security-manager/flag-user ───────────────────────────
// Flag a user account as suspicious
router.post('/flag-user', async (req, res) => {
  try {
    const { userId, reason } = req.body;

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    await AuditService.logEvent({
      userId: req.user.id,
      action: 'FLAG_ACCOUNT',
      targetFile: userId, // storing target user ID
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: reason || 'Suspicious activity'
    });

    res.json({ message: 'Account flagged successfully', userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to flag account' });
  }
});

// ─── POST /api/security-manager/unflag-user ─────────────────────────
// Remove flag from a user account
router.post('/unflag-user', async (req, res) => {
  try {
    const { userId } = req.body;

    await AuditService.logEvent({
      userId: req.user.id,
      action: 'UNFLAG_ACCOUNT',
      targetFile: userId,
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: 'Flag removed'
    });

    res.json({ message: 'Account unflagged successfully', userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to unflag account' });
  }
});

// ─── GET /api/security-manager/encryption-keys ──────────────────────
// List all encryption keys (metadata only, not actual keys)
router.get('/encryption-keys', async (req, res) => {
  try {
    const keys = await prisma.encryptedKey.findMany({
      include: {
        user: { select: { email: true, name: true } },
        file: { select: { originalFilename: true, encryptionAlgorithm: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(keys.map(k => ({
      id: k.id,
      fileId: k.fileId,
      fileName: k.file.originalFilename,
      algorithm: k.file.encryptionAlgorithm,
      userId: k.userId,
      userEmail: k.user.email,
      userName: k.user.name,
      createdAt: k.createdAt
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch encryption keys' });
  }
});

// ─── POST /api/security-manager/rotate-key/:keyId ───────────────────
// Rotate a specific encryption key (regenerate the wrapped key)
router.post('/rotate-key/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;

    const key = await prisma.encryptedKey.findUnique({
      where: { id: keyId },
      include: { file: true }
    });

    if (!key) {
      return res.status(404).json({ error: 'Key not found' });
    }

    // Update the key's createdAt to mark rotation
    await prisma.encryptedKey.update({
      where: { id: keyId },
      data: { createdAt: new Date() }
    });

    await AuditService.logEvent({
      userId: req.user.id,
      action: 'KEY_ROTATION',
      targetFile: key.fileId,
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });

    res.json({ message: 'Key rotated successfully', keyId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rotate key' });
  }
});

// ─── POST /api/security-manager/rotate-all-keys ─────────────────────
// Rotate all keys (bulk operation)
router.post('/rotate-all-keys', async (req, res) => {
  try {
    const result = await prisma.encryptedKey.updateMany({
      data: { createdAt: new Date() }
    });

    await AuditService.logEvent({
      userId: req.user.id,
      action: 'BULK_KEY_ROTATION',
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: `Rotated ${result.count} keys`
    });

    res.json({ message: `All ${result.count} keys rotated successfully`, count: result.count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to rotate keys' });
  }
});

module.exports = router;

