const mongoose = require('mongoose');

/**
 * VaultItem Model — Stores encrypted data of any file format.
 * Supports text, PDF, images, audio, video, documents, spreadsheets, archives, and more.
 */
const vaultItemSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  sensitivityLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    required: true
  },
  fileType: {
    type: String,
    enum: ['text', 'pdf', 'image', 'audio', 'video', 'document', 'spreadsheet', 'archive', 'other'],
    default: 'text'
  },
  originalFileName: {
    type: String,
    default: null
  },
  mimeType: {
    type: String,
    default: null
  },
  encryptedData: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  authTag: {
    type: String,
    default: null
  },
  encryptionStrategy: {
    type: String,
    enum: ['BASIC', 'STANDARD', 'STRONG', 'CHACHA', 'ADVANCED', 'LEGACY'],
    required: true
  },
  algorithm: {
    type: String,
    required: true
  },
  checksum: {
    type: String,
    default: null
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  metadata: {
    originalSize: Number,
    mimeType: String,
    encryptedAt: { type: Date, default: Date.now },
    contextSnapshot: {
      role: String,
      location: String,
      timeOfAccess: String,
      sensitivityLevel: String,
      policyDecision: String,
      deviceType: String
    }
  },
  accessCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

vaultItemSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('VaultItem', vaultItemSchema);
