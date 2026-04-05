const express = require('express');
const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory');
const Alert = require('../models/Alert');
const AuditService = require('../services/AuditService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/security/security-status
 * Get current user's security status overview.
 */
router.get('/security-status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('loginAttempts lockUntil isActive ipWhitelist');
    const recentLogins = await LoginHistory.find({ user: req.user._id })
      .sort({ loginTime: -1 }).limit(5);
    const unreadAlerts = await Alert.countDocuments({ user: req.user._id, isRead: false });

    res.json({
      isLocked: user.lockUntil && user.lockUntil > new Date(),
      lockUntil: user.lockUntil,
      loginAttempts: user.loginAttempts,
      isActive: user.isActive,
      ipWhitelist: user.ipWhitelist || [],
      recentLogins,
      unreadAlerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/security/sessions
 * List recent login sessions for current user.
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await LoginHistory.find({
      user: req.user._id,
      status: 'success'
    })
      .sort({ loginTime: -1 })
      .limit(20)
      .lean();

    // Add a lastActive field (approximation from loginTime)
    const enriched = sessions.map(s => ({
      ...s,
      lastActive: s.loginTime
    }));

    res.json({ sessions: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/security/sessions/:id
 * Revoke (delete) a specific session.
 */
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const result = await LoginHistory.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    if (!result) return res.status(404).json({ error: 'Session not found.' });

    await AuditService.log({
      userId: req.user._id, username: req.user.username, role: req.user.role,
      action: 'SESSION_REVOKED', details: `Session ${req.params.id} revoked`
    });

    res.json({ message: 'Session revoked.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/security/sessions
 * Revoke all other sessions (keep current).
 */
router.delete('/sessions', authenticate, async (req, res) => {
  try {
    const result = await LoginHistory.deleteMany({
      user: req.user._id,
      _id: { $ne: req.query.currentSession }
    });

    await AuditService.log({
      userId: req.user._id, username: req.user.username, role: req.user.role,
      action: 'ALL_SESSIONS_REVOKED', details: `${result.deletedCount} sessions revoked`
    });

    res.json({ message: `${result.deletedCount} sessions revoked.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/security/ip-whitelist
 * Update IP whitelist for current user.
 */
router.put('/ip-whitelist', authenticate, async (req, res) => {
  try {
    const { ipWhitelist } = req.body;
    if (!Array.isArray(ipWhitelist)) {
      return res.status(400).json({ error: 'ipWhitelist must be an array of IP strings.' });
    }

    await User.findByIdAndUpdate(req.user._id, { ipWhitelist });

    await AuditService.log({
      userId: req.user._id, username: req.user.username, role: req.user.role,
      action: 'IP_WHITELIST_UPDATED', details: `Updated to ${ipWhitelist.length} IPs: ${ipWhitelist.join(', ')}`
    });

    res.json({ message: 'IP whitelist updated.', ipWhitelist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
