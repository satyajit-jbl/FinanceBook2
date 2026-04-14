// Fix for Node.js v22+ DNS SRV bug with MongoDB Atlas on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
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

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// ── Trust proxy (required for Vercel / reverse-proxy deployments) ─
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────
// CLIENT_URL can be a comma-separated list:
//   development: http://localhost:3000
//   production:  https://your-app.netlify.app,https://custom-domain.com
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,          // Required for httpOnly cookies
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Explicitly handle pre-flight OPTIONS for all routes
app.options('*', cors());

// ── Middleware ────────────────────────────────────────────────────
if (!isProd) app.use(morgan('dev'));   // concise logs in dev only
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // Use IP (works behind Vercel proxy because of trust proxy above)
  keyGenerator: (req) => req.ip,
});
app.use('/api/', globalLimiter);

// ── Database ──────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/accounts',     verifyToken, accountRoutes);
app.use('/api/transactions', verifyToken, transactionRoutes);
app.use('/api/reports',      verifyToken, reportRoutes);
app.use('/api/admin',        verifyToken, adminRoutes);
app.use('/api/templates',    verifyToken, templateRoutes);
app.use('/api/budget',       verifyToken, budgetRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date() })
);

// ── 404 for unknown API routes ────────────────────────────────────
app.use('/api/*', (req, res) =>
  res.status(404).json({ success: false, message: 'API route not found' })
);

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Start (not needed for Vercel serverless, but fine to keep) ────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
);

module.exports = app;   // Required for Vercel serverless export
