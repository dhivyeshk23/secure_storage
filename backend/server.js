const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

app.use(cors({ 
  origin: [
    'https://frontend-omega-nine-52.vercel.app', 
    'http://localhost:5173', 
    'http://localhost:5174',
    'http://10.10.192.10:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// MongoDB connection with retry
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        retryReads: true
      });
      console.log('MongoDB Connected successfully');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    setTimeout(connectDB, 5000);
  }
};

connectDB();

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected, reconnecting...');
  connectDB();
});

// ─── Routes ─────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/vault', require('./routes/vaultRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));
app.use('/api/advanced', require('./routes/advancedRoutes'));
app.use('/api/security', require('./routes/securityRoutes'));
app.use('/api/keys', require('./routes/keyRoutes'));
app.use('/api', require('./routes/shareRoutes'));

// ─── Health Check ───────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
    }
  } catch (e) {
    console.log('Health check - MongoDB not ready');
  }
  res.json({
    status: 'Secure Data Vault API is running',
    mongoStatus: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT} (accessible on network at http://10.10.192.10:${PORT})`));
}

module.exports = app;
