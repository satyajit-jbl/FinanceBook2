const express = require('express');
const router = express.Router();
const { requireApproved } = require('../middleware/auth');
const Account = require('../models/Account');
const { AppError } = require('../middleware/errorHandler');
const SEED_ACCOUNTS = require('../data/seed_accounts.json');

// GET all accounts
router.get('/', requireApproved, async (req, res, next) => {
  try {
    const accounts = await Account.find({ userId: req.user.uid, isActive: true })
      .sort({ subAccount: 1, accountTitle: 1 });
    res.json({ success: true, accounts });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// SEED — bulk-create the Chart of Accounts from Excel data
// Only creates accounts that don't already exist (by title).
// Skips existing accounts so it's safe to call multiple times.
// ─────────────────────────────────────────────────────────────
router.post('/seed', requireApproved, async (req, res, next) => {
  try {
    // Check if any accounts already exist for this user
    const existingCount = await Account.countDocuments({ userId: req.user.uid, isActive: true });

    // Fetch existing titles for duplicate-check
    const existing = await Account.find({ userId: req.user.uid }, 'accountTitle').lean();
    const existingTitles = new Set(existing.map(a => a.accountTitle.trim().toLowerCase()));

    // Check if there's already a cash account marked
    const cashAlreadyMarked = await Account.findOne({ userId: req.user.uid, isCashAccount: true, isActive: true });

    const toInsert = [];
    for (const acc of SEED_ACCOUNTS) {
      if (existingTitles.has(acc.accountTitle.trim().toLowerCase())) continue;

      // If a cash account is already marked, don't mark another one
      const isCash = acc.isCashAccount && !cashAlreadyMarked;

      toInsert.push({
        userId:             req.user.uid,
        accountTitle:       acc.accountTitle,
        accountNo:          acc.accountNo || '',
        accountType:        acc.accountType,
        subAccount:         acc.subAccount,
        financialStatement: acc.financialStatement,
        openingBalance:     acc.currentBalance,   // seed value = opening balance from Excel TB
        currentBalance:     acc.currentBalance,   // starts equal; grows with transactions
        isCashAccount:      isCash,
        isActive:           true,
      });
    }

    if (toInsert.length === 0) {
      return res.json({
        success: true,
        inserted: 0,
        skipped: SEED_ACCOUNTS.length,
        message: 'All accounts already exist — nothing was added.',
      });
    }

    const inserted = await Account.insertMany(toInsert, { ordered: false });

    // Verify the grand total is zero after seeding
    const all = await Account.find({ userId: req.user.uid, isActive: true }).lean();
    const grandTotal = all.reduce((s, a) => s + (a.currentBalance || 0), 0);

    res.status(201).json({
      success:    true,
      inserted:   inserted.length,
      skipped:    SEED_ACCOUNTS.length - toInsert.length,
      total:      all.length,
      grandTotal: Math.round(grandTotal * 100) / 100,
      balanced:   Math.abs(grandTotal) < 1,
      message:    `Seeded ${inserted.length} accounts successfully.${SEED_ACCOUNTS.length - toInsert.length > 0 ? ` Skipped ${SEED_ACCOUNTS.length - toInsert.length} existing.` : ''}`,
    });
  } catch (err) { next(err); }
});

// Check if any cash account is already marked (used by frontend)
router.get('/cash-status', requireApproved, async (req, res, next) => {
  try {
    const cashAccount = await Account.findOne({ userId: req.user.uid, isCashAccount: true, isActive: true });
    res.json({ success: true, hasCashAccount: !!cashAccount, cashAccount: cashAccount || null });
  } catch (err) { next(err); }
});

// CREATE account
router.post('/', requireApproved, async (req, res, next) => {
  try {
    const { accountTitle, accountNo, accountType, subAccount, financialStatement, isCashAccount } = req.body;
    if (!accountTitle?.trim()) throw new AppError('Account title is required');
    if (!accountType)          throw new AppError('Account type is required');
    if (!subAccount)           throw new AppError('Sub-account category is required');
    if (!financialStatement)   throw new AppError('Financial statement is required');

    const existing = await Account.findOne({
      userId: req.user.uid,
      accountTitle: accountTitle.trim(),
      isActive: true,
    });
    if (existing) throw new AppError('Account with this title already exists', 409);

    // If requesting to mark as cash, ensure no other cash account exists
    let setCash = !!isCashAccount;
    if (setCash) {
      const existingCash = await Account.findOne({ userId: req.user.uid, isCashAccount: true, isActive: true });
      if (existingCash) {
        throw new AppError(`"${existingCash.accountTitle}" is already set as the Cash Account. Remove that designation first before assigning a new one.`, 409);
      }
    }

    const account = await Account.create({
      userId:             req.user.uid,
      accountTitle:       accountTitle.trim(),
      accountNo:          accountNo?.trim() || '',
      accountType,
      subAccount,
      financialStatement,
      currentBalance:     0,
      isCashAccount:      setCash,
    });
    res.status(201).json({ success: true, account });
  } catch (err) { next(err); }
});

// UPDATE account
router.put('/:id', requireApproved, async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!account) throw new AppError('Account not found', 404);
    if (account.isSystemAccount) throw new AppError('Cannot edit system accounts');

    const { accountTitle, accountNo, accountType, subAccount, financialStatement, isCashAccount } = req.body;

    // If trying to mark as cash, ensure no OTHER account is already cash
    if (isCashAccount && !account.isCashAccount) {
      const existingCash = await Account.findOne({
        userId: req.user.uid,
        isCashAccount: true,
        isActive: true,
        _id: { $ne: account._id },
      });
      if (existingCash) {
        throw new AppError(`"${existingCash.accountTitle}" is already set as the Cash Account. Unmark it first.`, 409);
      }
    }

    if (accountTitle)            account.accountTitle = accountTitle.trim();
    if (accountNo !== undefined) account.accountNo    = accountNo.trim();
    if (accountType)             account.accountType  = accountType;
    if (subAccount)              account.subAccount   = subAccount;
    if (financialStatement)      account.financialStatement = financialStatement;
    if (isCashAccount !== undefined) account.isCashAccount = isCashAccount;

    await account.save();
    res.json({ success: true, account });
  } catch (err) { next(err); }
});

// DELETE (deactivate) account
router.delete('/:id', requireApproved, async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!account) throw new AppError('Account not found', 404);
    if (account.isSystemAccount) throw new AppError('Cannot delete system accounts');
    if (Math.abs(account.currentBalance) > 0.01)
      throw new AppError('Cannot delete account with non-zero balance. Please zero out the balance first.');

    account.isActive = false;
    await account.save();
    res.json({ success: true, message: 'Account deactivated' });
  } catch (err) { next(err); }
});

// ACCOUNT LEDGER — with correct opening balance
router.get('/:id/ledger', requireApproved, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!account) throw new AppError('Account not found', 404);

    const Transaction = require('../models/Transaction');

    // Compute the seed balance (opening balance before any transaction)
    // seedBalance = currentBalance - (all-time transaction net for this account)
    const allTimeTxns = await Transaction.find({
      userId: req.user.uid, status: 'posted',
      'journalEntries.accountId': account._id,
    }, 'journalEntries');

    const allTimeNet = allTimeTxns.reduce((s, txn) => {
      const e = txn.journalEntries.find(e => e.accountId.toString() === account._id.toString());
      return s + (e ? e.debit - e.credit : 0);
    }, 0);

    const seedBalance = account.currentBalance - allTimeNet;

    // Opening balance = seed + transactions BEFORE startDate
    let openingBalance = seedBalance;
    if (startDate) {
      const beforeTxns = await Transaction.find({
        userId: req.user.uid, status: 'posted',
        'journalEntries.accountId': account._id,
        date: { $lt: new Date(startDate) },
      }, 'journalEntries');
      openingBalance += beforeTxns.reduce((s, txn) => {
        const e = txn.journalEntries.find(e => e.accountId.toString() === account._id.toString());
        return s + (e ? e.debit - e.credit : 0);
      }, 0);
    }

    // Fetch transactions in the requested range
    const filter = {
      userId: req.user.uid, status: 'posted',
      'journalEntries.accountId': account._id,
    };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate)   filter.date.$lte = new Date(endDate + 'T23:59:59');
    }

    const transactions = await Transaction.find(filter).sort({ date: 1, createdAt: 1 });

    let runningBalance = openingBalance;
    const ledger = transactions.map(txn => {
      const entry = txn.journalEntries.find(e => e.accountId.toString() === account._id.toString());
      runningBalance += entry.debit - entry.credit;
      return {
        date: txn.date, description: txn.description, reference: txn.reference,
        transactionId: txn._id, transactionType: txn.transactionType,
        debit: entry.debit, credit: entry.credit, balance: runningBalance,
      };
    });

    const totalDebit  = ledger.reduce((s, r) => s + r.debit,  0);
    const totalCredit = ledger.reduce((s, r) => s + r.credit, 0);

    res.json({
      success: true, account, ledger,
      openingBalance, totalDebit, totalCredit,
      closingBalance: runningBalance,
    });
  } catch (err) { next(err); }
});

module.exports = router;
