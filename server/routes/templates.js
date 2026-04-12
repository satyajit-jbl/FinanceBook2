const express  = require('express');
const router   = express.Router();
const { requireApproved } = require('../middleware/auth');
const Template = require('../models/TransactionTemplate');
const { AppError } = require('../middleware/errorHandler');

// GET all templates for user
router.get('/', requireApproved, async (req, res, next) => {
  try {
    const templates = await Template.find({ userId: req.user.uid })
      .sort({ lastUsed: -1, name: 1 });
    res.json({ success: true, templates });
  } catch (err) { next(err); }
});

// CREATE template
router.post('/', requireApproved, async (req, res, next) => {
  try {
    const { name, description, entries } = req.body;
    if (!name?.trim()) throw new AppError('Template name is required');
    if (!entries?.length || entries.length < 2) throw new AppError('At least 2 journal lines required');
    const totalDr = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const totalCr = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    if (Math.abs(totalDr - totalCr) > 0.01) throw new AppError(`Debits (${totalDr.toFixed(2)}) must equal Credits (${totalCr.toFixed(2)})`);

    const existing = await Template.findOne({ userId: req.user.uid, name: name.trim() });
    if (existing) throw new AppError(`A template named "${name.trim()}" already exists. Choose a different name.`, 409);

    const tpl = await Template.create({
      userId: req.user.uid,
      name: name.trim(),
      description: description?.trim() || '',
      entries,
    });
    res.status(201).json({ success: true, template: tpl });
  } catch (err) { next(err); }
});

// UPDATE template (re-save)
router.put('/:id', requireApproved, async (req, res, next) => {
  try {
    const { name, description, entries } = req.body;
    const tpl = await Template.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!tpl) throw new AppError('Template not found', 404);

    if (entries?.length) {
      const totalDr = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
      const totalCr = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
      if (Math.abs(totalDr - totalCr) > 0.01) throw new AppError(`Debits must equal Credits`);
      tpl.entries = entries;
    }
    if (name?.trim()) tpl.name = name.trim();
    if (description !== undefined) tpl.description = description.trim();
    tpl.usageCount += 1;
    tpl.lastUsed = new Date();
    await tpl.save();
    res.json({ success: true, template: tpl });
  } catch (err) { next(err); }
});

// RECORD usage (increment counter without full update)
router.post('/:id/use', requireApproved, async (req, res, next) => {
  try {
    await Template.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE template
router.delete('/:id', requireApproved, async (req, res, next) => {
  try {
    const tpl = await Template.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    if (!tpl) throw new AppError('Template not found', 404);
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
