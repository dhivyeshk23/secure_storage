const mongoose = require('mongoose');

/**
 * Folder Model
 * Organizes vault items into user-defined folders with color coding.
 */
const folderSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  color: {
    type: String,
    default: '#1a73e8',
    match: /^#[0-9A-Fa-f]{6}$/
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Unique folder names per user
folderSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);
