const mongoose = require('mongoose');

/*
 * Budget — monthly/yearly budget plan with per-account targets.
 * Each entry maps an account (from Chart of Accounts) to a budgeted amount.
 */
const budgetLineSchema = new mongoose.Schema({
  accountId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  accountTitle: { type: String, required: true },
  accountType:  { type: String },
  subAccount:   { type: String },  // Revenue or Expenses
  budgetedAmount: { type: Number, required: true, min: 0 },
  notes:        { type: String, default: '' },
}, { _id: false });

const budgetSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  name:      { type: String, required: true, maxlength: 100 }, // e.g. "April 2026 Budget"
  period:    { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  year:      { type: Number, required: true },
  month:     { type: Number, min: 1, max: 12 }, // null for yearly
  incomeLines:  { type: [budgetLineSchema], default: [] },
  expenseLines: { type: [budgetLineSchema], default: [] },
  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

budgetSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });
budgetSchema.index({ userId: 1, year: 1, month: 1 });

module.exports = mongoose.model('Budget', budgetSchema);
