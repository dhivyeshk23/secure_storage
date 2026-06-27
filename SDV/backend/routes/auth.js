const express = require('express');
const { register, login, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);

module.exports = router;
