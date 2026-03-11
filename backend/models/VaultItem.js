const mongoose = require('mongoose');

const vaultItemSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['Personal', 'Work', 'Finance', 'Medical', 'Legal', 'Other', 'Uncategorized'],
    default: 'Uncategorized'
  },
  sensitivityLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    required: true
  },
  fileType: {
    type: String,
    enum: ['text', 'pdf', 'note', 'password'],
    default: 'text'
  },
  originalFileName: {
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
    enum: ['BASIC', 'STANDARD', 'STRONG'],
    required: true
  },
  algorithm: {
    type: String,
    required: true
  },
  expiryDate: {
    type: Date,
    default: null
  },
  sharedWith: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sharedAt: { type: Date, default: Date.now },
    canDecrypt: { type: Boolean, default: true }
  }],
  accessHistory: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    location: String
  }],
  metadata: {
    originalSize: Number,
    mimeType: String,
    encryptedAt: { type: Date, default: Date.now },
    contextSnapshot: {
      role: String,
      location: String,
      timeOfAccess: String,
      sensitivityLevel: String,
      policyDecision: String
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('VaultItem', vaultItemSchema);
