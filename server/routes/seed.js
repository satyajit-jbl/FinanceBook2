const express = require('express');
const router  = express.Router();
const { requireApproved } = require('../middleware/auth');
const Account = require('../models/Account');
const { AppError } = require('../middleware/errorHandler');

const SEED_ACCOUNTS = require('./seedData');

router.get('/preview', requireApproved, (req, res) => {
  res.json({ success: true, count: SEED_ACCOUNTS.length, accounts: SEED_ACCOUNTS });
});

router.post('/accounts', requireApproved, async (req, res, next) => {
  try {
    const { force = false } = req.body;
    const userId = req.user.uid;
    const existing = await Account.countDocuments({ userId, isActive: true });

    if (existing > 0 && !force) {
      return res.status(409).json({
        success: false,
        message: `You already have ${existing} accounts. Use Force Reset to wipe and re-seed (admin only).`,
        existingCount: existing,
      });
    }

    if (force) {
      const User = require('../models/User');
      const user = await User.findOne({ uid: userId });
      if (!user || user.role !== 'admin') throw new AppError('Only admins can force-reset accounts', 403);
      await Account.updateMany({ userId }, { isActive: false });
    }

    const inserted = await Account.insertMany(
      SEED_ACCOUNTS.map(acc => ({
        userId,
        accountTitle:       acc.accountTitle,
        accountNo:          acc.accountNo || '',
        accountType:        acc.accountType,
        subAccount:         acc.subAccount,
        financialStatement: acc.financialStatement,
        currentBalance:     acc.currentBalance,
        isCashAccount:      !!acc.isCashAccount,
        isSystemAccount:    false,
      }))
    );

    const grandTotal = inserted.reduce((s, a) => s + a.currentBalance, 0);
    res.status(201).json({
      success: true,
      message: `Seeded ${inserted.length} accounts. Grand total: ${grandTotal.toFixed(4)}`,
      count: inserted.length,
      grandTotal,
      isBalanced: Math.abs(grandTotal) < 1,
    });
  } catch (err) { next(err); }
});

module.exports = router;
