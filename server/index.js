// Fix for Node.js v22+ DNS SRV bug with MongoDB Atlas on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const authRoutes        = require('./routes/auth');
const accountRoutes     = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const reportRoutes      = require('./routes/reports');
const adminRoutes       = require('./routes/admin');
const templateRoutes    = require('./routes/templates');
const budgetRoutes      = require('./routes/budget');
const { errorHandler }  = require('./middleware/errorHandler');
const { verifyToken }   = require('./middleware/auth');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

// Required for Vercel reverse proxy
app.set('trust proxy', 1);

// Security headers — disable policies that block cross-origin cookies/popups
app.use(helmet({
  crossOriginResourcePolicy:  false,
  crossOriginOpenerPolicy:    false,
  crossOriginEmbedderPolicy:  false,
}));

// ── MANUAL CORS MIDDLEWARE ────────────────────────────────────────
// We do NOT use the cors npm package — Vercel's edge strips those headers.
// Setting headers manually on every response guarantees they reach the browser.
const RAW_ORIGINS = process.env.CLIENT_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = RAW_ORIGINS
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

console.log('[CORS] Allowed origins:', ALLOWED_ORIGINS);

app.use((req, res, next) => {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  const allowed = !origin || ALLOWED_ORIGINS.includes(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin',      origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods',     'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers',     'Content-Type,Authorization,Cookie,X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers',    'Set-Cookie');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!allowed && origin) {
    console.error('[CORS] Blocked origin:', origin);
    return res.status(403).json({ success: false, message: `CORS: origin not allowed — ${origin}` });
  }

  next();
});

// ── Standard middleware ───────────────────────────────────────────
if (!isProd) app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', globalLimiter);

// ── Database ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/accounts',     verifyToken, accountRoutes);
app.use('/api/transactions', verifyToken, transactionRoutes);
app.use('/api/reports',      verifyToken, reportRoutes);
app.use('/api/admin',        verifyToken, adminRoutes);
app.use('/api/templates',    verifyToken, templateRoutes);
app.use('/api/budget',       verifyToken, budgetRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({
    status:         'ok',
    env:            process.env.NODE_ENV,
    allowedOrigins: ALLOWED_ORIGINS,
    ts:             new Date(),
  })
);

app.use('/api/*', (req, res) =>
  res.status(404).json({ success: false, message: 'API route not found' })
);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (!isProd) {
  app.listen(PORT, () =>
    console.log(`🚀 Server on http://localhost:${PORT}`)
  );
}

module.exports = app;