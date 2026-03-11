const express = require('express');
const multer = require('multer');
const VaultItem = require('../models/VaultItem');
const EncryptionKey = require('../models/EncryptionKey');
const User = require('../models/User');
const EncryptionEngine = require('../services/EncryptionEngine');
const PolicyEngine = require('../services/PolicyEngine');
const AuditService = require('../services/AuditService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * POST /api/vault/store
 * Store text data securely
 */
router.post('/store', authenticate, async (req, res) => {
  try {
    const { title, data, sensitivityLevel, category, expiryDays } = req.body;
    const user = req.user;

    if (!title || !data || !sensitivityLevel) {
      return res.status(400).json({ error: 'Title, data, and sensitivityLevel are required.' });
    }

    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(sensitivityLevel)) {
      return res.status(400).json({ error: 'Invalid sensitivity level.' });
    }

    const accessCheck = PolicyEngine.checkAccess(user.role, sensitivityLevel);
    if (!accessCheck.granted) {
      return res.status(403).json({ error: accessCheck.message });
    }

    const context = {
      role: user.role,
      sensitivityLevel,
      location: user.location,
      timestamp: new Date().toISOString()
    };
    const policyResult = PolicyEngine.evaluate(context);

    const encryptionResult = EncryptionEngine.encrypt(data, policyResult.strategy);
    const wrappedKey = EncryptionEngine.wrapKey(encryptionResult.dataKey, process.env.MASTER_ENCRYPTION_KEY);

    const expiryDate = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

    const vaultItem = new VaultItem({
      owner: user._id,
      title,
      category: category || 'Uncategorized',
      sensitivityLevel,
      fileType: 'text',
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv,
      authTag: encryptionResult.authTag,
      encryptionStrategy: policyResult.strategy,
      algorithm: encryptionResult.algorithm,
      expiryDate,
      accessHistory: [{
        action: 'CREATED',
        performedBy: user._id,
        timestamp: new Date(),
        location: user.location
      }],
      metadata: {
        originalSize: Buffer.byteLength(data, 'utf8'),
        encryptedAt: new Date(),
        contextSnapshot: {
          role: user.role,
          location: user.location,
          timeOfAccess: context.timestamp,
          sensitivityLevel,
          policyDecision: `${policyResult.strategy} (score: ${policyResult.score})`
        }
      }
    });
    await vaultItem.save();

    const encryptionKeyDoc = new EncryptionKey({
      vaultItem: vaultItem._id,
      owner: user._id,
      encryptedKey: wrappedKey.encryptedKey,
      keyIv: wrappedKey.keyIv,
      keyAuthTag: wrappedKey.keyAuthTag,
      algorithm: encryptionResult.algorithm
    });
    await encryptionKeyDoc.save();

    await AuditService.log({
      userId: user._id,
      username: user.username,
      role: user.role,
      action: 'STORE_DATA',
      resource: title,
      details: `Text stored with ${policyResult.strategy} encryption`,
      context: { sensitivityLevel, encryptionStrategy: policyResult.strategy }
    });

    res.status(201).json({
      message: 'Data stored securely',
      vaultItem: {
        id: vaultItem._id,
        title: vaultItem.title,
        category: vaultItem.category,
        sensitivityLevel: vaultItem.sensitivityLevel,
        fileType: 'text',
        encryptionStrategy: policyResult.strategy,
        algorithm: encryptionResult.algorithm,
        expiryDate: vaultItem.expiryDate,
        policyEvaluation: { score: policyResult.score, reasons: policyResult.reasons },
        storedAt: vaultItem.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store data: ' + error.message });
  }
});

/**
 * POST /api/vault/store/pdf
 * Store PDF file securely
 */
router.post('/store/pdf', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    const { title, sensitivityLevel, category, expiryDays } = req.body;
    const user = req.user;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'PDF file(s) required.' });
    }

    if (!title || !sensitivityLevel) {
      return res.status(400).json({ error: 'Title and sensitivityLevel are required.' });
    }

    const accessCheck = PolicyEngine.checkAccess(user.role, sensitivityLevel);
    if (!accessCheck.granted) {
      return res.status(403).json({ error: accessCheck.message });
    }

    const context = {
      role: user.role,
      sensitivityLevel,
      location: user.location,
      timestamp: new Date().toISOString()
    };
    const policyResult = PolicyEngine.evaluate(context);

    const expiryDate = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;
    const storedItems = [];

    for (const file of files) {
      const fileBuffer = file.buffer.toString('base64');
      const encryptionResult = EncryptionEngine.encrypt(fileBuffer, policyResult.strategy);
      const wrappedKey = EncryptionEngine.wrapKey(encryptionResult.dataKey, process.env.MASTER_ENCRYPTION_KEY);

      const vaultItem = new VaultItem({
        owner: user._id,
        title: files.length === 1 ? title : `${title} - ${file.originalname}`,
        category: category || 'Uncategorized',
        sensitivityLevel,
        fileType: 'pdf',
        originalFileName: file.originalname,
        encryptedData: encryptionResult.encryptedData,
        iv: encryptionResult.iv,
        authTag: encryptionResult.authTag,
        encryptionStrategy: policyResult.strategy,
        algorithm: encryptionResult.algorithm,
        expiryDate,
        accessHistory: [{
          action: 'CREATED',
          performedBy: user._id,
          timestamp: new Date(),
          location: user.location
        }],
        metadata: {
          originalSize: file.size,
          mimeType: file.mimetype,
          encryptedAt: new Date(),
          contextSnapshot: {
            role: user.role,
            location: user.location,
            timeOfAccess: context.timestamp,
            sensitivityLevel,
            policyDecision: `${policyResult.strategy}`
          }
        }
      });
      await vaultItem.save();

      const encryptionKeyDoc = new EncryptionKey({
        vaultItem: vaultItem._id,
        owner: user._id,
        encryptedKey: wrappedKey.encryptedKey,
        keyIv: wrappedKey.keyIv,
        keyAuthTag: wrappedKey.keyAuthTag,
        algorithm: encryptionResult.algorithm
      });
      await encryptionKeyDoc.save();

      storedItems.push({
        id: vaultItem._id,
        title: vaultItem.title,
        originalFileName: file.originalname
      });
    }

    await AuditService.log({
      userId: user._id,
      username: user.username,
      role: user.role,
      action: 'STORE_DATA',
      resource: title,
      details: `${files.length} PDF(s) stored with ${policyResult.strategy} encryption`,
      context: { sensitivityLevel, encryptionStrategy: policyResult.strategy }
    });

    res.status(201).json({
      message: `${files.length} PDF(s) stored securely`,
      storedItems,
      policyEvaluation: { score: policyResult.score, strategy: policyResult.strategy }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store PDF: ' + error.message });
  }
});

/**
 * GET /api/vault/retrieve/:id
 * Retrieve and decrypt data
 */
router.get('/retrieve/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const vaultItem = await VaultItem.findById(req.params.id);

    if (!vaultItem) {
      return res.status(404).json({ error: 'Vault item not found.' });
    }

    const isOwner = vaultItem.owner.toString() === user._id.toString();
    const isShared = vaultItem.sharedWith.some(s => s.user.toString() === user._id.toString());
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isShared && !isAdmin) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const keyDoc = await EncryptionKey.findOne({ vaultItem: vaultItem._id });
    if (!keyDoc) {
      return res.status(500).json({ error: 'Encryption key not found.' });
    }

    const dataKeyHex = EncryptionEngine.unwrapKey(
      keyDoc.encryptedKey, keyDoc.keyIv, keyDoc.keyAuthTag, process.env.MASTER_ENCRYPTION_KEY
    );

    const decryptedData = EncryptionEngine.decrypt(
      vaultItem.encryptedData, dataKeyHex, vaultItem.iv,
      vaultItem.encryptionStrategy, vaultItem.authTag
    );

    vaultItem.accessHistory.push({
      action: 'RETRIEVED',
      performedBy: user._id,
      timestamp: new Date(),
      location: user.location
    });
    await vaultItem.save();

    if (vaultItem.fileType === 'pdf') {
      const pdfBuffer = Buffer.from(decryptedData, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${vaultItem.originalFileName}"`);
      return res.send(pdfBuffer);
    }

    let parsedData = decryptedData;
    if (vaultItem.fileType === 'password') {
      try {
        parsedData = JSON.parse(decryptedData);
      } catch (e) { /* keep as string */ }
    }

    res.json({
      message: 'Data retrieved successfully',
      vaultItem: {
        id: vaultItem._id,
        title: vaultItem.title,
        category: vaultItem.category,
        sensitivityLevel: vaultItem.sensitivityLevel,
        fileType: vaultItem.fileType,
        encryptionStrategy: vaultItem.encryptionStrategy,
        algorithm: vaultItem.algorithm,
        data: parsedData,
        metadata: vaultItem.metadata,
        storedAt: vaultItem.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve: ' + error.message });
  }
});

/**
 * GET /api/vault/view-encrypted/:id
 * View encrypted data
 */
router.get('/view-encrypted/:id', authenticate, async (req, res) => {
  try {
    const { title, content, sensitivityLevel, category, expiryDays } = req.body;
    const user = req.user;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const accessCheck = PolicyEngine.checkAccess(user.role, sensitivityLevel || 'LOW');
    if (!accessCheck.granted) {
      return res.status(403).json({ error: accessCheck.message });
    }

    const level = sensitivityLevel || 'LOW';
    const context = { role: user.role, sensitivityLevel: level, location: user.location, timestamp: new Date().toISOString() };
    const policyResult = PolicyEngine.evaluate(context);

    const encryptionResult = EncryptionEngine.encrypt(content, policyResult.strategy);
    const wrappedKey = EncryptionEngine.wrapKey(encryptionResult.dataKey, process.env.MASTER_ENCRYPTION_KEY);

    const expiryDate = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

    const vaultItem = new VaultItem({
      owner: user._id,
      title,
      category: category || 'Personal',
      sensitivityLevel: level,
      fileType: 'note',
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv,
      authTag: encryptionResult.authTag,
      encryptionStrategy: policyResult.strategy,
      algorithm: encryptionResult.algorithm,
      expiryDate,
      accessHistory: [{ action: 'CREATED', performedBy: user._id, timestamp: new Date(), location: user.location }],
      metadata: { originalSize: Buffer.byteLength(content, 'utf8'), encryptedAt: new Date() }
    });
    await vaultItem.save();

    const encryptionKeyDoc = new EncryptionKey({
      vaultItem: vaultItem._id, owner: user._id,
      encryptedKey: wrappedKey.encryptedKey, keyIv: wrappedKey.keyIv,
      keyAuthTag: wrappedKey.keyAuthTag, algorithm: encryptionResult.algorithm
    });
    await encryptionKeyDoc.save();

    res.status(201).json({ message: 'Secure note stored', vaultItem: { id: vaultItem._id, title, category: vaultItem.category, strategy: policyResult.strategy } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store note: ' + error.message });
  }
});

/**
 * POST /api/vault/store/password
 * Store password securely
 */
router.post('/store/password', authenticate, async (req, res) => {
  try {
    const { title, username, password, website, sensitivityLevel, category } = req.body;
    const user = req.user;

    if (!title || !password) {
      return res.status(400).json({ error: 'Title and password are required.' });
    }

    const content = JSON.stringify({ username, password, website, generatedAt: new Date().toISOString() });
    const context = { role: user.role, sensitivityLevel: 'HIGH', location: user.location, timestamp: new Date().toISOString() };
    const policyResult = PolicyEngine.evaluate(context);

    const encryptionResult = EncryptionEngine.encrypt(content, policyResult.strategy);
    const wrappedKey = EncryptionEngine.wrapKey(encryptionResult.dataKey, process.env.MASTER_ENCRYPTION_KEY);

    const vaultItem = new VaultItem({
      owner: user._id,
      title,
      category: category || 'Personal',
      sensitivityLevel: 'HIGH',
      fileType: 'password',
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv,
      authTag: encryptionResult.authTag,
      encryptionStrategy: policyResult.strategy,
      algorithm: encryptionResult.algorithm,
      accessHistory: [{ action: 'CREATED', performedBy: user._id, timestamp: new Date(), location: user.location }],
      metadata: { originalSize: Buffer.byteLength(content, 'utf8'), encryptedAt: new Date() }
    });
    await vaultItem.save();

    const encryptionKeyDoc = new EncryptionKey({
      vaultItem: vaultItem._id, owner: user._id,
      encryptedKey: wrappedKey.encryptedKey, keyIv: wrappedKey.keyIv,
      keyAuthTag: wrappedKey.keyAuthTag, algorithm: encryptionResult.algorithm
    });
    await encryptionKeyDoc.save();

    res.status(201).json({ message: 'Password stored securely', vaultItem: { id: vaultItem._id, title, strategy: policyResult.strategy } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store password: ' + error.message });
  }
});

/**
 * GET /api/vault/items
 * List all vault items with search and filter
 */
router.get('/items', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { search, category, fileType, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = {};

    if (user.role !== 'admin') {
      query.$or = [{ owner: user._id }, { 'sharedWith.user': user._id }];
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    if (category && category !== 'All') {
      query.category = category;
    }
    if (fileType && fileType !== 'all') {
      query.fileType = fileType;
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const items = await VaultItem.find(query)
      .select('-encryptedData -iv -authTag')
      .populate('owner', 'username role')
      .populate('sharedWith.user', 'username email')
      .sort(sort);

    await AuditService.log({
      userId: user._id,
      username: user.username,
      role: user.role,
      action: 'RETRIEVE_ALL',
      details: `Listed ${items.length} vault items`
    });

    res.json({ count: items.length, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list items: ' + error.message });
  }
});

/**
 * GET /api/vault/categories
 * Get categories with counts
 */
router.get('/categories', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const query = user.role === 'admin' ? {} : { owner: user._id };

    const categories = await VaultItem.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const total = await VaultItem.countDocuments(query);

    res.json({ categories, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get categories: ' + error.message });
  }
});

/**
 * GET /api/vault/stats
 * Get dashboard statistics
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const query = user.role === 'admin' ? {} : { owner: user._id };

    const totalItems = await VaultItem.countDocuments(query);
    const bySensitivity = await VaultItem.aggregate([
      { $match: query },
      { $group: { _id: '$sensitivityLevel', count: { $sum: 1 } } }
    ]);
    const byCategory = await VaultItem.aggregate([
      { $match: query },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const byFileType = await VaultItem.aggregate([
      { $match: query },
      { $group: { _id: '$fileType', count: { $sum: 1 } } }
    ]);
    const byEncryption = await VaultItem.aggregate([
      { $match: query },
      { $group: { _id: '$encryptionStrategy', count: { $sum: 1 } } }
    ]);

    const recentActivity = await VaultItem.find(query)
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('owner', 'username');

    res.json({
      totalItems,
      bySensitivity,
      byCategory,
      byFileType,
      byEncryption,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats: ' + error.message });
  }
});

/**
 * GET /api/vault/share/:id
 * Get users to share with
 */
router.get('/share-users', authenticate, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username email role')
      .limit(20);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users: ' + error.message });
  }
});

/**
 * POST /api/vault/share/:id
 * Share vault item with another user
 */
router.post('/share/:id', authenticate, async (req, res) => {
  try {
    const { userId, canDecrypt } = req.body;
    const vaultItem = await VaultItem.findById(req.params.id);

    if (!vaultItem) {
      return res.status(404).json({ error: 'Vault item not found.' });
    }

    if (vaultItem.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only owner can share.' });
    }

    const existingShare = vaultItem.sharedWith.find(s => s.user.toString() === userId);
    if (existingShare) {
      existingShare.canDecrypt = canDecrypt !== false;
    } else {
      vaultItem.sharedWith.push({ user: userId, canDecrypt: canDecrypt !== false });
    }

    vaultItem.accessHistory.push({
      action: 'SHARED',
      performedBy: req.user._id,
      timestamp: new Date(),
      location: req.user.location
    });

    await vaultItem.save();

    await AuditService.log({
      userId: req.user._id,
      username: req.user.username,
      role: req.user.role,
      action: 'SHARE_DATA',
      resource: vaultItem.title,
      details: `Shared with user ${userId}`
    });

    res.json({ message: 'Item shared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share: ' + error.message });
  }
});

/**
 * GET /api/vault/timeline/:id
 * Get access history timeline
 */
router.get('/timeline/:id', authenticate, async (req, res) => {
  try {
    const vaultItem = await VaultItem.findById(req.params.id)
      .populate('accessHistory.performedBy', 'username');

    if (!vaultItem) {
      return res.status(404).json({ error: 'Vault item not found.' });
    }

    if (vaultItem.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ timeline: vaultItem.accessHistory });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get timeline: ' + error.message });
  }
});

/**
 * PUT /api/vault/category/:id
 * Update item category
 */
router.put('/category/:id', authenticate, async (req, res) => {
  try {
    const { category } = req.body;
    const vaultItem = await VaultItem.findById(req.params.id);

    if (!vaultItem) {
      return res.status(404).json({ error: 'Vault item not found.' });
    }

    if (vaultItem.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    vaultItem.category = category;
    vaultItem.accessHistory.push({
      action: 'CATEGORY_CHANGED',
      performedBy: req.user._id,
      timestamp: new Date()
    });

    await vaultItem.save();
    res.json({ message: 'Category updated', category: vaultItem.category });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category: ' + error.message });
  }
});

/**
 * GET /api/vault/policy-simulator
 * Simulate encryption for different scenarios
 */
router.get('/policy-simulator', authenticate, async (req, res) => {
  try {
    const { role, sensitivity, location } = req.query;
    const context = {
      role: role || 'employee',
      sensitivityLevel: sensitivity || 'MEDIUM',
      location: location || 'external',
      timestamp: new Date().toISOString()
    };
    const result = PolicyEngine.evaluate(context);

    res.json({
      scenario: context,
      result: {
        strategy: result.strategy,
        score: result.score,
        reasons: result.reasons,
        recommendedActions: result.score >= 60 ? ['Use STRONG encryption', 'Enable 2FA', 'Review access logs'] :
                         result.score >= 35 ? ['Use STANDARD encryption', 'Monitor access patterns'] :
                         ['BASIC encryption sufficient', 'Standard security practices apply']
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Simulation failed: ' + error.message });
  }
});

/**
 * DELETE /api/vault/delete/:id
 * Delete vault item
 */
router.delete('/delete/:id', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const vaultItem = await VaultItem.findById(req.params.id);

    if (!vaultItem) {
      return res.status(404).json({ error: 'Vault item not found.' });
    }

    if (vaultItem.owner.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await EncryptionKey.deleteOne({ vaultItem: vaultItem._id });
    await VaultItem.findByIdAndDelete(req.params.id);

    await AuditService.log({
      userId: user._id,
      username: user.username,
      role: user.role,
      action: 'DELETE_DATA',
      resource: vaultItem.title
    });

    res.json({ message: 'Vault item deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete: ' + error.message });
  }
});

module.exports = router;
