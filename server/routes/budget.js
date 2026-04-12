const express  = require('express');
const router   = express.Router();
const { requireApproved } = require('../middleware/auth');
const Budget   = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Account  = require('../models/Account');
const { AppError } = require('../middleware/errorHandler');

// GET all budgets
router.get('/', requireApproved, async (req, res, next) => {
  try {
    const budgets = await Budget.find({ userId: req.user.uid }).sort({ year: -1, month: -1 });
    res.json({ success: true, budgets });
  } catch (err) { next(err); }
});

// GET single budget with actuals comparison
router.get('/:id', requireApproved, async (req, res, next) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!budget) throw new AppError('Budget not found', 404);

    // Build date range for actuals
    let startDate, endDate;
    if (budget.period === 'monthly' && budget.month) {
      startDate = new Date(budget.year, budget.month - 1, 1);
      endDate   = new Date(budget.year, budget.month, 0, 23, 59, 59);
    } else {
      startDate = new Date(budget.year, 0, 1);
      endDate   = new Date(budget.year, 11, 31, 23, 59, 59);
    }

    // Sum actuals per account from transactions
    const txns = await Transaction.find({
      userId: req.user.uid, status: 'posted',
      date: { $gte: startDate, $lte: endDate },
    });
    const actuals = {}; // accountId → net (Dr - Cr)
    for (const txn of txns) {
      for (const e of txn.journalEntries) {
        const id = e.accountId.toString();
        if (!actuals[id]) actuals[id] = 0;
        actuals[id] += e.debit - e.credit;
      }
    }

    // Augment budget lines with actuals
    const augment = (lines) => lines.map(line => {
      const actual = Math.abs(actuals[line.accountId.toString()] || 0);
      const variance = line.budgetedAmount - actual;
      const pct = line.budgetedAmount > 0 ? (actual / line.budgetedAmount) * 100 : 0;
      return { ...line.toObject(), actual, variance, pct: Math.round(pct) };
    });

    const totalBudgetIncome  = budget.incomeLines.reduce((s, l) => s + l.budgetedAmount, 0);
    const totalBudgetExpense = budget.expenseLines.reduce((s, l) => s + l.budgetedAmount, 0);
    const totalActualIncome  = budget.incomeLines.reduce((s, l) => s + Math.abs(actuals[l.accountId.toString()] || 0), 0);
    const totalActualExpense = budget.expenseLines.reduce((s, l) => s + Math.abs(actuals[l.accountId.toString()] || 0), 0);

    res.json({
      success: true,
      budget: {
        ...budget.toObject(),
        incomeLines:  augment(budget.incomeLines),
        expenseLines: augment(budget.expenseLines),
      },
      summary: {
        totalBudgetIncome, totalBudgetExpense,
        totalActualIncome, totalActualExpense,
        budgetNet:  totalBudgetIncome  - totalBudgetExpense,
        actualNet:  totalActualIncome  - totalActualExpense,
        incomeVariance:  totalBudgetIncome  - totalActualIncome,
        expenseVariance: totalBudgetExpense - totalActualExpense,
      },
    });
  } catch (err) { next(err); }
});

// CREATE budget
router.post('/', requireApproved, async (req, res, next) => {
  try {
    const { name, period, year, month, incomeLines, expenseLines } = req.body;
    if (!name?.trim())  throw new AppError('Budget name is required');
    if (!year)          throw new AppError('Year is required');
    if (period === 'monthly' && !month) throw new AppError('Month is required for monthly budgets');

    const budget = await Budget.create({
      userId: req.user.uid,
      name: name.trim(), period: period || 'monthly',
      year: parseInt(year), month: month ? parseInt(month) : null,
      incomeLines:  incomeLines  || [],
      expenseLines: expenseLines || [],
    });
    res.status(201).json({ success: true, budget });
  } catch (err) { next(err); }
});

// UPDATE budget
router.put('/:id', requireApproved, async (req, res, next) => {
  try {
    const { name, incomeLines, expenseLines } = req.body;
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!budget) throw new AppError('Budget not found', 404);
    if (name?.trim())   budget.name = name.trim();
    if (incomeLines)    budget.incomeLines  = incomeLines;
    if (expenseLines)   budget.expenseLines = expenseLines;
    await budget.save();
    res.json({ success: true, budget });
  } catch (err) { next(err); }
});

// DELETE budget
router.delete('/:id', requireApproved, async (req, res, next) => {
  try {
    await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    res.json({ success: true, message: 'Budget deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
