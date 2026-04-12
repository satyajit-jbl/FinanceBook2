const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { verifyToken, admin } = require('../middleware/auth');
const User      = require('../models/User');

// ── Helpers ───────────────────────────────────────────────────────
const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// In production: Netlify (client) and Vercel (server) are different origins.
// Cross-origin cookies REQUIRE SameSite=None + Secure.
// In development: SameSite=lax works on same origin (localhost).
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   isProd,                      // HTTPS only in production
  sameSite: isProd ? 'none' : 'lax',    // 'none' required for cross-origin
  maxAge:   7 * 24 * 60 * 60 * 1000,   // 7 days in ms
  path:     '/',
};

function signJwt(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { uid: user.uid, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function setAuthCookie(res, token) {
  res.cookie('authToken', token, COOKIE_OPTS);
}

function clearAuthCookie(res) {
  res.clearCookie('authToken', { path: '/' });
}

async function findOrCreateUser({ uid, email, displayName, provider }) {
  const userCount = await User.countDocuments();
  const isFirst   = userCount === 0;
  let user = await User.findOne({ uid });
  if (!user) {
    user = await User.create({
      uid, email, displayName, provider,
      role:       isFirst ? 'admin' : 'user',
      isApproved: isFirst,
    });
  }
  user.lastLogin = new Date();
  await user.save();
  return user;
}

// ── Rate limiters ─────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ══════════════════════════════════════════════════════════════════
// LOCAL REGISTRATION  POST /api/auth/local/register
// ══════════════════════════════════════════════════════════════════
router.post(
  '/local/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and a number'),
    body('displayName').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }

      const { email, password, displayName } = req.body;

      // Check existing email
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const uid = `local_${uuidv4()}`;

      const userCount  = await User.countDocuments();
      const isFirst    = userCount === 0;

      const user = await User.create({
        uid, email: email.toLowerCase(), displayName: displayName.trim(),
        provider: 'local', passwordHash,
        role:       isFirst ? 'admin' : 'user',
        isApproved: isFirst,
        lastLogin:  new Date(),
      });

      // If first user (admin), issue token immediately
      if (isFirst) {
        const token = signJwt(user);
        setAuthCookie(res, token);
        return res.status(201).json({ success: true, user: user.toSafeObject(), token });
      }

      res.status(201).json({
        success: true,
        user: user.toSafeObject(),
        message: 'Account created. Please wait for admin approval.',
      });
    } catch (err) { next(err); }
  }
);

// ══════════════════════════════════════════════════════════════════
// LOCAL LOGIN  POST /api/auth/local/login
// ══════════════════════════════════════════════════════════════════
router.post(
  '/local/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || user.provider !== 'local') {
        // Generic message — don't reveal whether email exists
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
      }

      user.lastLogin = new Date();
      await user.save();

      const token = signJwt(user);
      setAuthCookie(res, token);

      res.json({ success: true, user: user.toSafeObject(), token });
    } catch (err) { next(err); }
  }
);

// ══════════════════════════════════════════════════════════════════
// GOOGLE SYNC  POST /api/auth/google/sync
// Called after Firebase Google sign-in to create/fetch DB user
// ══════════════════════════════════════════════════════════════════
router.post('/google/sync', verifyToken, async (req, res, next) => {
  try {
    const { displayName } = req.body;
    const user = await findOrCreateUser({
      uid:         req.user.uid,
      email:       req.user.email,
      displayName: displayName?.trim() || req.user.email.split('@')[0],
      provider:    'google',
    });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// LEGACY REGISTER (Firebase token sync) — kept for backward compat
// POST /api/auth/register
// ══════════════════════════════════════════════════════════════════
router.post('/register', verifyToken, async (req, res, next) => {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) {
      return res.status(400).json({ success: false, message: 'Display name is required' });
    }
    const user = await findOrCreateUser({
      uid:         req.user.uid,
      email:       req.user.email,
      displayName: displayName.trim(),
      provider:    req.user.provider || 'google',
    });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// LOGOUT  POST /api/auth/logout
// ══════════════════════════════════════════════════════════════════
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

// ══════════════════════════════════════════════════════════════════
// GET CURRENT USER  GET /api/auth/me
// ══════════════════════════════════════════════════════════════════
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found. Please register.' });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// CHANGE PASSWORD  POST /api/auth/change-password
// Only for local users; requires old password verification
// ══════════════════════════════════════════════════════════════════
router.post(
  '/change-password',
  authLimiter,
  verifyToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('New password must contain uppercase, lowercase and a number'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findOne({ uid: req.user.uid });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      // Only local users can change password here
      if (user.provider !== 'local') {
        return res.status(400).json({ success: false, message: 'Password change is only available for email/password accounts. Google accounts manage passwords through Google.' });
      }

      // Verify current password
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      }

      // Prevent re-using same password
      const isSame = await bcrypt.compare(newPassword, user.passwordHash);
      if (isSame) {
        return res.status(400).json({ success: false, message: 'New password must be different from current password.' });
      }

      user.passwordHash = await bcrypt.hash(newPassword, 12);
      await user.save();

      // Issue new JWT (old one still technically valid until expiry, but we refresh it)
      const token = signJwt(user);
      setAuthCookie(res, token);

      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
