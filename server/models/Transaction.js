const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  accountTitle: { type: String, required: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
}, { _id: false });

const editHistorySchema = new mongoose.Schema({
  editedAt: { type: Date, required: true, default: Date.now },
  editedBy: { type: String, required: true }, // uid
  editReason: { type: String, required: true, maxlength: 500 },
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  transactionType: {
    type: String,
    required: true,
    enum: ['cash_receive', 'cash_payment', 'fund_transfer', 'multiple_fund_transfer']
  },
  date: { type: Date, required: true, index: true },
  description: { type: String, required: true, maxlength: 500 },
  reference: { type: String, default: '' },
  amount: { type: Number }, // For simple transactions; null for multiple
  journalEntries: {
    type: [journalLineSchema],
    validate: {
      validator: function(entries) {
        if (entries.length < 2) return false;
        const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
        const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
        return Math.abs(totalDebit - totalCredit) < 0.01; // floating point tolerance
      },
      message: 'Total debits must equal total credits (double-entry violation)'
    }
  },
  totalAmount: { type: Number, required: true }, // sum of all debits = sum of all credits
  status: { type: String, enum: ['posted', 'void'], default: 'posted' },
  voidedAt: { type: Date },
  voidedBy: { type: String },
  voidReason: { type: String },
  editedAt: { type: Date },
  editedBy: { type: String },
  editReason: { type: String },
  editHistory: { type: [editHistorySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

transactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for fast ledger queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, 'journalEntries.accountId': 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
