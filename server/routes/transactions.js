const express = require('express');
const router = express.Router();
const { requireApproved } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const { AppError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// SIGN CONVENTION (standard double-entry, same as Excel):
//   currentBalance = openingBalance + SUM(Debits) - SUM(Credits)
//
//   Debiting  an account → balance INCREASES  (+debit)
//   Crediting an account → balance DECREASES  (-credit)
//
//   Assets:      debit-normal  → positive balance
//   Liabilities: credit-normal → negative balance
//   Equity:      credit-normal → negative balance
//   Revenue:     credit-normal → negative balance
//   Expenses:    debit-normal  → positive balance
// ─────────────────────────────────────────────────────────────────────────────

// Apply journal entries: update each account's currentBalance
// multiplier = 1 (post) or -1 (void/reverse)
async function applyJournalEntries(userId, journalEntries, session, multiplier = 1) {
  for (const entry of journalEntries) {
    const account = await Account.findOne({ _id: entry.accountId, userId }).session(session);
    if (!account) throw new AppError(`Account not found: ${entry.accountTitle}`);
    // Standard: debit increases balance, credit decreases balance
    account.currentBalance += multiplier * (entry.debit - entry.credit);
    await account.save({ session });
  }
}

async function getCashAccount(userId) {
  const cash = await Account.findOne({ userId, isCashAccount: true, isActive: true });
  if (!cash) throw new AppError('No cash account configured. Go to Chart of Accounts and mark one account as "Cash Account".', 400);
  return cash;
}

// ── GET all transactions ──────────────────────────────────────────────────────
router.get('/', requireApproved, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type, startDate, endDate, accountId } = req.query;
    const filter = { userId: req.user.uid };
    if (type) filter.transactionType = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate)   filter.date.$lte = new Date(endDate + 'T23:59:59');
    }
    if (accountId) filter['journalEntries.accountId'] = accountId;

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, transactions, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── GET single transaction ────────────────────────────────────────────────────
router.get('/:id', requireApproved, async (req, res, next) => {
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!txn) throw new AppError('Transaction not found', 404);
    res.json({ success: true, transaction: txn });
  } catch (err) { next(err); }
});

// ── 1. Cash Receive: Dr Cash / Cr Income account ──────────────────────────────
router.post('/cash-receive', requireApproved, async (req, res, next) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { date, accountId, amount, description, reference } = req.body;
    if (!date)                              throw new AppError('Date is required');
    if (!accountId)                         throw new AppError('Account is required');
    if (!amount || parseFloat(amount) <= 0) throw new AppError('Amount must be greater than zero');
    if (!description?.trim())              throw new AppError('Description is required');

    const cashAcc   = await getCashAccount(req.user.uid);
    const incomeAcc = await Account.findOne({ _id: accountId, userId: req.user.uid, isActive: true }).session(session);
    if (!incomeAcc) throw new AppError('Selected account not found');

    const amt = parseFloat(amount);
    // Dr Cash (asset ↑), Cr Income account (revenue ↑ in credit direction)
    const journalEntries = [
      { accountId: cashAcc._id,   accountTitle: cashAcc.accountTitle,   debit: amt, credit: 0   },
      { accountId: incomeAcc._id, accountTitle: incomeAcc.accountTitle, debit: 0,   credit: amt },
    ];

    const [txn] = await Transaction.create([{
      userId: req.user.uid, transactionType: 'cash_receive',
      date: new Date(date), description: description.trim(),
      reference: reference?.trim() || '', amount: amt, totalAmount: amt, journalEntries,
    }], { session });

    await applyJournalEntries(req.user.uid, journalEntries, session);
    await session.commitTransaction();
    res.status(201).json({ success: true, transaction: txn });
  } catch (err) { await session.abortTransaction(); next(err); }
  finally { session.endSession(); }
});

// ── 2. Cash Payment: Dr Expense account / Cr Cash ────────────────────────────
router.post('/cash-payment', requireApproved, async (req, res, next) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { date, accountId, amount, description, reference } = req.body;
    if (!date)                              throw new AppError('Date is required');
    if (!accountId)                         throw new AppError('Account is required');
    if (!amount || parseFloat(amount) <= 0) throw new AppError('Amount must be greater than zero');
    if (!description?.trim())              throw new AppError('Description is required');

    const cashAcc    = await getCashAccount(req.user.uid);
    const expenseAcc = await Account.findOne({ _id: accountId, userId: req.user.uid, isActive: true }).session(session);
    if (!expenseAcc) throw new AppError('Selected account not found');

    const amt = parseFloat(amount);
    // Dr Expense (expense ↑), Cr Cash (asset ↓)
    const journalEntries = [
      { accountId: expenseAcc._id, accountTitle: expenseAcc.accountTitle, debit: amt, credit: 0   },
      { accountId: cashAcc._id,    accountTitle: cashAcc.accountTitle,    debit: 0,   credit: amt },
    ];

    const [txn] = await Transaction.create([{
      userId: req.user.uid, transactionType: 'cash_payment',
      date: new Date(date), description: description.trim(),
      reference: reference?.trim() || '', amount: amt, totalAmount: amt, journalEntries,
    }], { session });

    await applyJournalEntries(req.user.uid, journalEntries, session);
    await session.commitTransaction();
    res.status(201).json({ success: true, transaction: txn });
  } catch (err) { await session.abortTransaction(); next(err); }
  finally { session.endSession(); }
});

// ── 3. Fund Transfer: Dr one account / Cr another ────────────────────────────
router.post('/fund-transfer', requireApproved, async (req, res, next) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { date, debitAccountId, creditAccountId, amount, description, reference } = req.body;
    if (!date)                                        throw new AppError('Date is required');
    if (!debitAccountId)                              throw new AppError('Debit account is required');
    if (!creditAccountId)                             throw new AppError('Credit account is required');
    if (debitAccountId === creditAccountId)           throw new AppError('Debit and credit accounts must be different');
    if (!amount || parseFloat(amount) <= 0)          throw new AppError('Amount must be greater than zero');
    if (!description?.trim())                         throw new AppError('Description is required');

    const debitAcc  = await Account.findOne({ _id: debitAccountId,  userId: req.user.uid, isActive: true }).session(session);
    const creditAcc = await Account.findOne({ _id: creditAccountId, userId: req.user.uid, isActive: true }).session(session);
    if (!debitAcc)  throw new AppError('Debit account not found');
    if (!creditAcc) throw new AppError('Credit account not found');

    const amt = parseFloat(amount);
    const journalEntries = [
      { accountId: debitAcc._id,  accountTitle: debitAcc.accountTitle,  debit: amt, credit: 0   },
      { accountId: creditAcc._id, accountTitle: creditAcc.accountTitle, debit: 0,   credit: amt },
    ];

    const [txn] = await Transaction.create([{
      userId: req.user.uid, transactionType: 'fund_transfer',
      date: new Date(date), description: description.trim(),
      reference: reference?.trim() || '', amount: amt, totalAmount: amt, journalEntries,
    }], { session });

    await applyJournalEntries(req.user.uid, journalEntries, session);
    await session.commitTransaction();
    res.status(201).json({ success: true, transaction: txn });
  } catch (err) { await session.abortTransaction(); next(err); }
  finally { session.endSession(); }
});

// ── 4. Multiple Fund Transfer: multiple Dr and Cr lines (ΣDr = ΣCr) ──────────
router.post('/multiple-fund-transfer', requireApproved, async (req, res, next) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { date, description, reference, entries } = req.body;
    if (!date)              throw new AppError('Date is required');
    if (!description?.trim()) throw new AppError('Description is required');
    if (!Array.isArray(entries) || entries.length < 2)
      throw new AppError('At least 2 journal entry lines are required');

    const totalDebit  = entries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01)
      throw new AppError(`Total Debits (৳${totalDebit.toFixed(2)}) must equal Total Credits (৳${totalCredit.toFixed(2)})`);
    if (totalDebit === 0)
      throw new AppError('Total amount cannot be zero');

    const journalEntries = [];
    for (const entry of entries) {
      const dr = parseFloat(entry.debit)  || 0;
      const cr = parseFloat(entry.credit) || 0;
      if (dr === 0 && cr === 0) continue;
      if (dr > 0 && cr > 0)
        throw new AppError('Each line can only have a Debit OR a Credit, not both');

      const acc = await Account.findOne({ _id: entry.accountId, userId: req.user.uid, isActive: true }).session(session);
      if (!acc) throw new AppError(`Account not found: ${entry.accountTitle || entry.accountId}`);
      journalEntries.push({ accountId: acc._id, accountTitle: acc.accountTitle, debit: dr, credit: cr });
    }

    const [txn] = await Transaction.create([{
      userId: req.user.uid, transactionType: 'multiple_fund_transfer',
      date: new Date(date), description: description.trim(),
      reference: reference?.trim() || '', totalAmount: totalDebit, journalEntries,
    }], { session });

    await applyJournalEntries(req.user.uid, journalEntries, session);
    await session.commitTransaction();
    res.status(201).json({ success: true, transaction: txn });
  } catch (err) { await session.abortTransaction(); next(err); }
  finally { session.endSession(); }
});

// ── Void a transaction (reverse all entries) ──────────────────────────────────
router.post('/:id/void', requireApproved, async (req, res, next) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { reason } = req.body;
    if (!reason?.trim()) throw new AppError('Void reason is required');

    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user.uid }).session(session);
    if (!txn)                   throw new AppError('Transaction not found', 404);
    if (txn.status === 'void') throw new AppError('Transaction is already voided');

    // Reverse all journal entries (multiplier = -1)
    await applyJournalEntries(req.user.uid, txn.journalEntries, session, -1);

    txn.status    = 'void';
    txn.voidedAt  = new Date();
    txn.voidedBy  = req.user.uid;
    txn.voidReason = reason.trim();
    await txn.save({ session });

    await session.commitTransaction();
    res.json({ success: true, transaction: txn });
  } catch (err) { await session.abortTransaction(); next(err); }
  finally { session.endSession(); }
});

module.exports = router;
