const mongoose = require('mongoose');

// SIGN CONVENTION (Standard Double-Entry, matches Excel):
// currentBalance = openingBalance + SUM(Debits) - SUM(Credits)
//
// Assets       → Normal Debit  → positive currentBalance
// Liabilities  → Normal Credit → negative currentBalance
// Equity       → Normal Credit → negative currentBalance
// Revenue      → Normal Credit → negative currentBalance
// Expenses     → Normal Debit  → positive currentBalance
//
// Balance Sheet:
//   Assets:      show currentBalance as-is (positive number)
//   Liabilities: show Math.abs(currentBalance)  (flip sign)
//   Equity:      show Math.abs(currentBalance)  (flip sign)
// Income Statement:
//   Revenue:     show Math.abs(currentBalance)  (flip sign)
//   Expenses:    show currentBalance as-is      (positive number)

const accountSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  accountTitle: { type: String, required: true },
  accountNo:    { type: String, default: '' },
  accountType:  { type: String, required: true },
  subAccount: {
    type: String,
    required: true,
    enum: ['Current Assets','Investments','Fixed Assets',
           'Current Liabilities','Short-term Liabilities','Long-term Liabilities',
           'Equity','Revenue','Expenses'],
  },
  financialStatement: { type: String, enum: ['Balance Sheet','Income Statement',''], default: '' },
  openingBalance: { type: Number, default: 0 }, // Dr - Cr from opening entry
  currentBalance: { type: Number, default: 0 }, // openingBalance + allDr - allCr
  isActive:        { type: Boolean, default: true },
  isCashAccount:   { type: Boolean, default: false },
  isSystemAccount: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

accountSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('Account', accountSchema);
