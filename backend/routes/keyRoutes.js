const express = require('express');
const KeyManagementService = require('../services/KeyManagementService');
const EncryptionEngine = require('../services/EncryptionEngine');
const AuditService = require('../services/AuditService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/keys/status
 * Get key management status and rotation schedule.
 */
router.get('/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const rotationStatus = await KeyManagementService.checkRotationStatus();
    const serviceStatus = KeyManagementService.getStatus();
    const strategies = EncryptionEngine.listStrategies();

    res.json({
      keyManagement: serviceStatus,
      rotation: rotationStatus,
      availableStrategies: strategies
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/keys/rotate
 * Trigger key rotation for expired keys (Admin only).
 */
router.post('/rotate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    if (!masterKey) {
      return res.status(500).json({ error: 'Master encryption key not configured.' });
    }

    const results = await KeyManagementService.rotateExpiredKeys(masterKey);

    await AuditService.log({
      userId: req.user._id, username: req.user.username, role: req.user.role,
      action: 'KEY_ROTATION', details: `Rotated ${results.rotated} keys, ${results.failed} failed`
    });

    res.json({
      message: 'Key rotation complete.',
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/keys/strategies
 * List all available encryption strategies (public info).
 */
router.get('/strategies', authenticate, async (req, res) => {
  try {
    const strategies = EncryptionEngine.listStrategies();
    res.json({ strategies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
