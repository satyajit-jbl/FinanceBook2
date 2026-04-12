const mongoose = require('mongoose');

/*
 * TransactionTemplate — saved multiple-transfer journal entry templates.
 * Users can save a named template, auto-fill it next time, edit, and re-save.
 */
const entrySchema = new mongoose.Schema({
  accountId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  accountTitle: { type: String, required: true },
  debit:        { type: Number, default: 0, min: 0 },
  credit:       { type: Number, default: 0, min: 0 },
}, { _id: false });

const templateSchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },
  name:        { type: String, required: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  entries:     { type: [entrySchema], required: true },
  usageCount:  { type: Number, default: 0 },
  lastUsed:    { type: Date },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

templateSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });
templateSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('TransactionTemplate', templateSchema);
