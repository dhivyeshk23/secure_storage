const express = require('express');
const { getPendingUsers, approveUser, getStats, getLogs, getAllUsers, deleteUser } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authenticate);

// Admin-only actions
router.get('/pending-users', authorize('Admin'), getPendingUsers);
router.post('/approve-user', authorize('Admin'), approveUser);

// Admin can view all user accounts (with flags) and delete them
router.get('/all-users', authorize('Admin'), getAllUsers);
router.delete('/users/:userId', authorize('Admin'), deleteUser);

// Both Admin and Security Manager can view stats and logs
router.get('/stats', authorize('Admin', 'Security Manager'), getStats);
router.get('/logs', authorize('Admin', 'Security Manager'), getLogs);

module.exports = router;
