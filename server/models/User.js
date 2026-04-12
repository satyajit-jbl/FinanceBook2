const mongoose = require('mongoose');

/*
 * User model supports two auth providers:
 *  - provider: 'google'  → authenticated via Firebase/Google OAuth
 *                          uid = Firebase UID, passwordHash = null
 *  - provider: 'local'   → authenticated via email + password
 *                          uid = generated UUID, passwordHash = bcrypt hash
 *
 * JWT tokens (for local users) and Firebase tokens (for google users)
 * both resolve to the same User document via the uid field.
 */
const userSchema = new mongoose.Schema({
  uid:          { type: String, required: true, unique: true, index: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName:  { type: String, required: true },
  provider:     { type: String, enum: ['google', 'local'], required: true, default: 'local' },
  passwordHash: { type: String, default: null },   // bcrypt hash; null for google users
  role:         { type: String, enum: ['admin', 'user'], default: 'user' },
  isApproved:   { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
  approvedBy:   { type: String },
  approvedAt:   { type: Date },
  lastLogin:    { type: Date },
  createdAt:    { type: Date, default: Date.now },
});

// Never expose passwordHash in API responses
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
