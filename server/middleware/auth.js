const jwt        = require('jsonwebtoken');
const admin      = require('firebase-admin');

// ── Initialise Firebase Admin (only once) ────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

/*
 * verifyToken — accepts either:
 *   A) Firebase ID token (for Google-auth users)  — Bearer <firebase_token>
 *   B) Local JWT                                   — httpOnly cookie  OR  Bearer <jwt>
 *
 * Sets req.user = { uid, email, provider }
 */
const verifyToken = async (req, res, next) => {
  try {
    // 1. Try httpOnly cookie first (local JWT)
    const cookieToken = req.cookies?.authToken;
    if (cookieToken) {
      const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET);
      req.user = { uid: decoded.uid, email: decoded.email, provider: 'local' };
      return next();
    }

    // 2. Try Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' });
    }
    const token = authHeader.split('Bearer ')[1];

    // 3. Try as local JWT first (faster, no network)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { uid: decoded.uid, email: decoded.email, provider: 'local' };
      return next();
    } catch (jwtErr) {
      // Not a valid local JWT — try Firebase
    }

    // 4. Try as Firebase ID token
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email, provider: 'google' };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ uid: req.user.uid });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.dbUser = user;
    next();
  } catch (err) { next(err); }
};

const requireApproved = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ uid: req.user.uid });
    if (!user)           return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.isApproved) return res.status(403).json({ success: false, message: 'Account pending admin approval' });
    if (!user.isActive)   return res.status(403).json({ success: false, message: 'Account has been deactivated' });
    req.dbUser = user;
    next();
  } catch (err) { next(err); }
};

module.exports = { verifyToken, requireAdmin, requireApproved, admin };
