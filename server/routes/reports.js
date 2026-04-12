const express    = require('express');
const router     = express.Router();
const { requireApproved } = require('../middleware/auth');
const Account    = require('../models/Account');
const Transaction = require('../models/Transaction');
const { AppError } = require('../middleware/errorHandler');

/*
 * ═══════════════════════════════════════════════════════════════════
 * BALANCE MODEL — two fields, one source of truth
 * ═══════════════════════════════════════════════════════════════════
 *
 * account.openingBalance  = the seed value set from the Excel Trial Balance.
 *                           Never changes after seeding.
 *
 * account.currentBalance  = openingBalance + Σ(all posted txn debits)
 *                                          − Σ(all posted txn credits)
 *                           Updated in real-time by every transaction.
 *
 * Sign convention (matches Excel exactly):
 *   Assets   & Expenses  →  positive balance  (Debit-normal)
 *   Liabilities, Equity, Revenue  →  negative balance  (Credit-normal)
 *   Grand total of ALL accounts = 0  (accounting identity)
 *
 * ── Trial Balance columns ─────────────────────────────────────────
 *   Opening Balance Dr/Cr  → from openingBalance
 *   Transaction Dr / Cr    → sum of posted transaction debits/credits
 *   Present Balance Dr/Cr  → from currentBalance  (opening + txns)
 *
 * ── Income Statement ──────────────────────────────────────────────
 *   All-time:    currentBalance  (includes seed + all transactions)
 *   Date-range:  openingBalance + transactions within range
 *
 * ── Balance Sheet ─────────────────────────────────────────────────
 *   Uses currentBalance for all accounts.
 *   Net Income (from IS) added to Equity as Retained Earnings.
 *   Total Assets = Total Liabilities + Total Equity  ✓
 * ═══════════════════════════════════════════════════════════════════
 */

// Helper: sum transaction debits/credits per account (all posted, up to endDate)
async function getTxnTotals(userId, endDate) {
  const filter = { userId, status: 'posted' };
  if (endDate) filter.date = { $lte: new Date(endDate + 'T23:59:59') };
  const txns = await Transaction.find(filter, 'journalEntries');
  const map = {};
  for (const txn of txns) {
    for (const e of txn.journalEntries) {
      const id = e.accountId.toString();
      if (!map[id]) map[id] = { debit: 0, credit: 0 };
      map[id].debit  += e.debit;
      map[id].credit += e.credit;
    }
  }
  return map;
}

// Helper: sum transaction debits/credits per account within a date range
async function getTxnTotalsRange(userId, startDate, endDate) {
  const filter = { userId, status: 'posted' };
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate)   filter.date.$lte = new Date(endDate + 'T23:59:59');
  }
  const txns = await Transaction.find(filter, 'journalEntries');
  const map = {};
  for (const txn of txns) {
    for (const e of txn.journalEntries) {
      const id = e.accountId.toString();
      if (!map[id]) map[id] = { debit: 0, credit: 0 };
      map[id].debit  += e.debit;
      map[id].credit += e.credit;
    }
  }
  return map;
}

// ══════════════════════════════════════════════════════════════════
// TRIAL BALANCE
// Columns:
//   Opening Balance (Dr) / Opening Balance (Cr)  ← openingBalance
//   Transaction Debit    / Transaction Credit     ← posted txn totals
//   Present Balance (Dr) / Present Balance (Cr)  ← currentBalance
// ══════════════════════════════════════════════════════════════════
router.get('/trial-balance', requireApproved, async (req, res, next) => {
  try {
    const { asOfDate } = req.query;

    const accounts = await Account.find({ userId: req.user.uid, isActive: true })
      .sort({ subAccount: 1, accountTitle: 1 });

    // All posted transaction totals (for "Transaction Debit / Credit" columns)
    const txnMap = await getTxnTotals(req.user.uid, asOfDate);

    const rows = accounts.map(acc => {
      const t = txnMap[acc._id.toString()] || { debit: 0, credit: 0 };

      // Opening balance (seeded from Excel) — never changes
      const openingBalance = acc.openingBalance || 0;

      // Present balance — live value (seed + all transactions to date)
      // If asOfDate provided: seed + txns up to that date
      // If no filter: acc.currentBalance is already fully up to date
      const txnNet = t.debit - t.credit;
      const presentBalance = openingBalance + txnNet;

      // For display: separate into Dr (positive) and Cr (negative→positive)
      const openDr = openingBalance > 0 ?  openingBalance : 0;
      const openCr = openingBalance < 0 ? -openingBalance : 0;
      const presDr = presentBalance  > 0 ?  presentBalance : 0;
      const presCr = presentBalance  < 0 ? -presentBalance : 0;

      return {
        _id:                acc._id,
        accountTitle:       acc.accountTitle,
        accountNo:          acc.accountNo,
        accountType:        acc.accountType,
        subAccount:         acc.subAccount,
        financialStatement: acc.financialStatement,
        // Opening balance columns
        openingBalance,
        openDr,
        openCr,
        // Transaction activity columns (posted txns in period)
        txnDebit:  t.debit,
        txnCredit: t.credit,
        // Present (closing) balance columns
        presentBalance,
        presDr,
        presCr,
      };
    });

    // Grand totals
    const grandOpenDr  = rows.reduce((s, r) => s + r.openDr,  0);
    const grandOpenCr  = rows.reduce((s, r) => s + r.openCr,  0);
    const grandTxnDr   = rows.reduce((s, r) => s + r.txnDebit,  0);
    const grandTxnCr   = rows.reduce((s, r) => s + r.txnCredit, 0);
    const grandPresDr  = rows.reduce((s, r) => s + r.presDr,  0);
    const grandPresCr  = rows.reduce((s, r) => s + r.presCr,  0);

    // Balance check: sum of all present balances should be ~0
    const grandTotal = rows.reduce((s, r) => s + r.presentBalance, 0);

    res.json({
      success: true,
      rows,
      grandOpenDr, grandOpenCr,
      grandTxnDr,  grandTxnCr,
      grandPresDr, grandPresCr,
      grandTotal: Math.round(grandTotal * 100) / 100,
      isBalanced: Math.abs(grandTotal) < 1,
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// INCOME STATEMENT
//
// All-time (no filter):
//   balance = currentBalance  (openingBalance + all txn net)
//   Revenue display  = -currentBalance  (flip Cr-normal → positive)
//   Expense display  = +currentBalance  (Dr-normal, already positive)
//
// Date-range filter:
//   balance = openingBalance + txn net within range
//   This ensures seeded IS balances are included even in date filters.
// ══════════════════════════════════════════════════════════════════
router.get('/income-statement', requireApproved, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const isFiltered = !!(startDate || endDate);

    const accounts = await Account.find({
      userId: req.user.uid,
      isActive: true,
      financialStatement: 'Income Statement',
    });

    let getBalance;

    if (!isFiltered) {
      // All-time: currentBalance already = openingBalance + all txn net
      getBalance = (acc) => acc.currentBalance;
    } else {
      // Date-range: openingBalance (seed) + transactions within the range
      const rangeTotals = await getTxnTotalsRange(req.user.uid, startDate, endDate);
      getBalance = (acc) => {
        const t = rangeTotals[acc._id.toString()] || { debit: 0, credit: 0 };
        const txnNet = t.debit - t.credit;
        return (acc.openingBalance || 0) + txnNet;
      };
    }

    const mapRow = (acc) => {
      const balance = getBalance(acc);
      return {
        _id:           acc._id,
        accountTitle:  acc.accountTitle,
        accountType:   acc.accountType,
        subAccount:    acc.subAccount,
        currentBalance: balance,
        // Revenue is Cr-normal (negative balance) → flip for positive display
        // Expense is Dr-normal (positive balance) → display as-is
        displayAmount: acc.subAccount === 'Revenue' ? -balance : balance,
      };
    };

    const revenueAccounts = accounts.filter(a => a.subAccount === 'Revenue').map(mapRow);
    const expenseAccounts = accounts.filter(a => a.subAccount === 'Expenses').map(mapRow);

    const groupBy = (rows) => rows.reduce((g, r) => {
      const k = r.accountType || 'Other';
      if (!g[k]) g[k] = [];
      g[k].push(r);
      return g;
    }, {});

    const totalRevenue  = revenueAccounts.reduce((s, r) => s + r.displayAmount, 0);
    const totalExpenses = expenseAccounts.reduce((s, r) => s + r.displayAmount, 0);

    const incomeTaxRow       = expenseAccounts.find(r => r.accountTitle === 'Income Tax');
    const incomeTax          = incomeTaxRow ? incomeTaxRow.displayAmount : 0;
    const netIncomeBeforeTax = totalRevenue - (totalExpenses - incomeTax);
    const netIncomeAfterTax  = netIncomeBeforeTax - incomeTax;

    res.json({
      success: true,
      revenueAccounts,
      expenseAccounts,
      revenueGroups: groupBy(revenueAccounts),
      expenseGroups: groupBy(expenseAccounts),
      totalRevenue,
      totalExpenses,
      incomeTax,
      netIncome: netIncomeAfterTax,
      netIncomeBeforeTax,
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// BALANCE SHEET
// All values from currentBalance (openingBalance + all txn effects).
// Net Income from IS added to Equity section.
// Total Assets = Total Liabilities + Total Equity  ✓
// ══════════════════════════════════════════════════════════════════
router.get('/balance-sheet', requireApproved, async (req, res, next) => {
  try {
    const allAccounts = await Account.find({ userId: req.user.uid, isActive: true });

    const bsAccounts = allAccounts.filter(a => a.financialStatement === 'Balance Sheet');
    const isAccounts = allAccounts.filter(a => a.financialStatement === 'Income Statement');

    const assetAccounts     = bsAccounts.filter(a => ['Current Assets','Investments','Fixed Assets'].includes(a.subAccount));
    const liabilityAccounts = bsAccounts.filter(a => ['Current Liabilities','Short-term Liabilities','Long-term Liabilities'].includes(a.subAccount));
    const equityAccounts    = bsAccounts.filter(a => a.subAccount === 'Equity');

    // Assets: positive currentBalance → display as-is
    const totalAssets      = assetAccounts.reduce((s, a) => s + a.currentBalance, 0);

    // Liabilities: negative currentBalance → flip sign for display
    const totalLiabilities = liabilityAccounts.reduce((s, a) => s + (-a.currentBalance), 0);

    // Equity (owner's capital accounts): negative → flip
    const totalEquityBase  = equityAccounts.reduce((s, a) => s + (-a.currentBalance), 0);

    // Net Income from IS (all-time, using currentBalance which = opening + all txns)
    const totalRevenue  = isAccounts.filter(a => a.subAccount === 'Revenue')
                                    .reduce((s, a) => s + (-a.currentBalance), 0);
    const totalExpenses = isAccounts.filter(a => a.subAccount === 'Expenses')
                                    .reduce((s, a) => s + a.currentBalance, 0);
    const incomeTaxRow  = isAccounts.find(a => a.accountTitle === 'Income Tax');
    const incomeTax     = incomeTaxRow ? incomeTaxRow.currentBalance : 0;
    const netIncome     = totalRevenue - totalExpenses; // after tax (Income Tax is inside totalExpenses)

    const totalEquity = totalEquityBase + netIncome;
    const isBalanced  = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

    const mapAcc = a => ({
      _id: a._id, accountTitle: a.accountTitle, accountType: a.accountType,
      subAccount: a.subAccount, currentBalance: a.currentBalance,
    });

    res.json({
      success: true,
      assetAccounts:     assetAccounts.map(mapAcc),
      liabilityAccounts: liabilityAccounts.map(mapAcc),
      equityAccounts:    equityAccounts.map(mapAcc),
      totalAssets, totalLiabilities, totalEquityBase, totalEquity,
      netIncome, isBalanced,
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// CASH FLOW STATEMENT (Indirect Method)
//
// Cash items (accountType === 'Cash') are EXCLUDED from all activity
// sections — they ARE the cash balance, not a use/source of cash.
// Ending Cash Balance = sum of all Cash-type accounts.
// ══════════════════════════════════════════════════════════════════
router.get('/cash-flow', requireApproved, async (req, res, next) => {
  try {
    const allAccounts = await Account.find({ userId: req.user.uid, isActive: true });

    // Net Income from IS (all-time)
    const isAccounts    = allAccounts.filter(a => a.financialStatement === 'Income Statement');
    const totalRevenue  = isAccounts.filter(a => a.subAccount === 'Revenue')
                                    .reduce((s, a) => s + (-a.currentBalance), 0);
    const totalExpenses = isAccounts.filter(a => a.subAccount === 'Expenses')
                                    .reduce((s, a) => s + a.currentBalance, 0);
    const netIncome     = totalRevenue - totalExpenses;

    // Cash items — excluded from activity sections, used for ending balance
    // accountType === 'Cash' covers: Cash in Hand, Emergency Stock, BD New Notes & Bundles
    // Prize Bond is accountType 'Investment' in Investments — NOT excluded
    const CASH_TYPES = ['Cash'];
    const cashAccounts = allAccounts.filter(a => CASH_TYPES.includes(a.accountType) && a.financialStatement === 'Balance Sheet');
    const cashAccountIds = new Set(cashAccounts.map(a => a._id.toString()));

    const bsAccounts = allAccounts.filter(a => a.financialStatement === 'Balance Sheet');

    const buildRows = (subAccounts) =>
      bsAccounts
        .filter(a => subAccounts.includes(a.subAccount) && !cashAccountIds.has(a._id.toString()))
        .map(a => ({
          _id:            a._id,
          accountTitle:   a.accountTitle,
          subAccount:     a.subAccount,
          accountType:    a.accountType,
          currentBalance: a.currentBalance,
          cashImpact:     -a.currentBalance,
        }))
        .filter(r => Math.abs(r.cashImpact) > 0.005);

    // OPERATING = non-cash current assets (bank accounts, receivables, DPS, FDs etc.)
    const operatingRows = buildRows(['Current Assets']);
    // INVESTING = investments + fixed assets (no cash items here anyway)
    const investingRows = buildRows(['Investments', 'Fixed Assets']);
    // FINANCING = liabilities + equity
    const financingRows = buildRows(['Current Liabilities','Short-term Liabilities','Long-term Liabilities','Equity']);

    const netOperating = operatingRows.reduce((s, r) => s + r.cashImpact, 0);
    const netInvesting = investingRows.reduce((s, r) => s + r.cashImpact, 0);
    const netFinancing = financingRows.reduce((s, r) => s + r.cashImpact, 0);
    const netCashChange = netIncome + netOperating + netInvesting + netFinancing;

    // Ending Cash Balance = sum of all Cash-type accounts
    const endingCash = cashAccounts.reduce((s, a) => s + a.currentBalance, 0);
    const cashItems  = cashAccounts.map(a => ({
      _id: a._id, accountTitle: a.accountTitle, currentBalance: a.currentBalance,
    }));

    res.json({
      success: true,
      netIncome,
      operatingRows, investingRows, financingRows,
      netOperating, netInvesting, netFinancing,
      netCashChange,
      endingCash,
      cashItems, // individual cash accounts for display
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// ACCOUNT LEDGER (also exposed via accounts route)
// ══════════════════════════════════════════════════════════════════
router.get('/ledger/:accountId', requireApproved, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const account = await Account.findOne({ _id: req.params.accountId, userId: req.user.uid });
    if (!account) throw new AppError('Account not found', 404);

    const filter = {
      userId: req.user.uid, status: 'posted',
      'journalEntries.accountId': account._id,
    };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate)   filter.date.$lte = new Date(endDate + 'T23:59:59');
    }

    // Opening balance = seed + txns before startDate
    const seedBalance = account.openingBalance || 0;
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

    const totalDebit  = ledger.reduce((s, r) => s + r.debit, 0);
    const totalCredit = ledger.reduce((s, r) => s + r.credit, 0);

    res.json({
      success: true, account, ledger,
      seedBalance,
      openingBalance, totalDebit, totalCredit,
      closingBalance: runningBalance,
    });
  } catch (err) { next(err); }
});

module.exports = router;
