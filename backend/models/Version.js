const mongoose = require('mongoose');

/**
 * Version Model
 * Tracks version history for vault items, enabling rollback to previous states.
 * Implements the Memento pattern — captures encrypted data snapshots.
 */
const versionSchema = new mongoose.Schema({
  vaultItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultItem',
    required: true,
    index: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  previousData: {
    type: String,
    required: true
  },
  previousIv: {
    type: String,
    default: null
  },
  changeType: {
    type: String,
    enum: ['created', 'updated', 'restored', 're-encrypted'],
    default: 'updated'
  },
  note: {
    type: String,
    default: ''
  }
}, { timestamps: true });

versionSchema.index({ vaultItem: 1, versionNumber: -1 });

module.exports = mongoose.model('Version', versionSchema);
