const mongoose = require('mongoose');

/**
 * LoginHistory Model
 * Tracks all login attempts for security auditing and suspicious activity detection.
 * Implements the Active Record pattern for self-contained persistence.
 */
const loginHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'blocked'],
    default: 'success'
  },
  location: {
    type: String,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Index for efficient recent-login queries
loginHistorySchema.index({ user: 1, loginTime: -1 });

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
