const mongoose = require('mongoose');

/**
 * ShareLink Model — Stores timed, shareable download links for vault items.
 * Uses MongoDB TTL index on expiresAt for automatic cleanup of expired links.
 */
const shareLinkSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  vaultItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultItem',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  label: {
    type: String,
    trim: true,
    default: ''
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL — MongoDB auto-deletes after this date
  },
  maxDownloads: {
    type: Number,
    default: 0 // 0 = unlimited
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  password: {
    type: String,
    default: null // bcrypt hash, null = no password
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastDownloadedAt: {
    type: Date,
    default: null
  },
  downloaderIPs: [{
    ip: String,
    downloadedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Compound index for listing links by user
shareLinkSchema.index({ createdBy: 1, createdAt: -1 });
// Compound index for listing links by vault item
shareLinkSchema.index({ vaultItem: 1, isActive: 1 });

module.exports = mongoose.model('ShareLink', shareLinkSchema);
