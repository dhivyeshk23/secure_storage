const mongoose = require('mongoose');

/**
 * Alert Model
 * Security alerts for suspicious activity, account locks, and policy violations.
 * Implements the Observer notification pattern.
 */
const alertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'suspicious_login', 'account_locked', 'access_denied',
      'rate_limit_exceeded', 'key_rotation', 'integrity_violation',
      'critical_access', 'new_device', 'off_hours_access'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

alertSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
