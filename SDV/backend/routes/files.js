const express = require('express');
const multer = require('multer');
const { uploadFile, shareFile, getUserFiles, downloadFile, deleteFile } = require('../controllers/fileController');
const { authenticate, authorize } = require('../middleware/rbacMiddleware');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Protect all file routes
router.use(authenticate);

// List user's files
router.get('/', getUserFiles);

// Upload — Users only
router.post('/upload', authorize('User'), upload.single('file'), uploadFile);

// Download (requires password in x-vault-password header)
router.get('/download/:fileId', downloadFile);

// Delete
router.delete('/:fileId', deleteFile);

// Share — Users only
router.post('/share', authorize('User'), shareFile);

module.exports = router;
