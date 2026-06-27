const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const CryptoService = require('../services/cryptoService');
const AuditService = require('../services/auditService');

const prisma = new PrismaClient();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });
};

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create random salt for PBKDF2
    const cryptoSalt = crypto.randomBytes(16).toString('hex');

    // Generate RSA Key Pair
    const { publicKey, privateKey } = CryptoService.generateRSAKeyPair();

    // Encrypt Private Key with PBKDF2 derived key from the plaintext password
    const encryptedPrivateKey = CryptoService.encryptPrivateKey(privateKey, password, cryptoSalt);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        salt: cryptoSalt,
        status: 'PENDING',
        publicKey,
        encryptedPrivateKey
      }
    });

    await AuditService.logEvent({
      userId: user.id,
      action: 'Register',
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });

    res.status(201).json({ message: 'Registration successful. Pending admin approval.' });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await AuditService.logEvent({
        userId: user.id,
        action: 'Login',
        status: 'FAILED',
        ipAddress: req.ip,
        device: req.headers['user-agent']
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: `Account is ${user.status}` });
    }

    const token = generateToken(user.id);
    const roles = user.roles.map(ur => ur.role.name);

    await AuditService.logEvent({
      userId: user.id,
      action: 'Login',
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles
      }
    });
  } catch (error) {
    req.logger?.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  
  if (req.user) {
    await AuditService.logEvent({
      userId: req.user.id,
      action: 'Logout',
      status: 'SUCCESS',
      ipAddress: req.ip,
      device: req.headers['user-agent']
    });
  }

  res.status(200).json({ success: true, message: 'User logged out successfully' });
};
