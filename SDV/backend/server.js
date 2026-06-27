const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const winston = require('winston');

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Logger Configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));

app.use(cors({
  origin: [
    'https://frontend-omega-nine-52.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://10.10.192.10:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-vault-password']
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Make prisma and logger available in req
app.use((req, res, next) => {
  req.prisma = prisma;
  req.logger = logger;
  next();
});

// ─── Health Check ───────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'SecureVault Enterprise API is running',
      dbStatus: 'Connected (PostgreSQL)',
      timestamp: new Date().toISOString(),
      version: '3.0.0'
    });
  } catch (e) {
    logger.error('Health check - DB not ready', e);
    res.status(500).json({ error: 'Database not connected' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/security-manager', require('./routes/securityManager'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected on app termination');
  process.exit(0);
});

module.exports = app;
