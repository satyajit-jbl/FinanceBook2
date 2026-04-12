const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

// Get all users
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { next(err); }
});

// Approve user
router.post('/users/:uid/approve', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) throw new AppError('User not found', 404);
    if (user.uid === req.user.uid) throw new AppError('Cannot modify your own approval status');

    user.isApproved = true;
    user.approvedBy = req.user.uid;
    user.approvedAt = new Date();
    await user.save();
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// Revoke user approval
router.post('/users/:uid/revoke', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) throw new AppError('User not found', 404);
    if (user.role === 'admin') throw new AppError('Cannot revoke admin approval');
    user.isApproved = false;
    await user.save();
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// Toggle active status
router.post('/users/:uid/toggle-active', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) throw new AppError('User not found', 404);
    if (user.uid === req.user.uid) throw new AppError('Cannot deactivate your own account');
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// Promote to admin
router.post('/users/:uid/make-admin', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) throw new AppError('User not found', 404);
    user.role = 'admin';
    user.isApproved = true;
    await user.save();
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

module.exports = router;
