const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ALLOWED_CATEGORIES, FREQUENCIES } = require('../constants/newsCategories');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minLength: [3, 'Name must be at least 3 characters'],
      maxLength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be a valid email address'],
    },
    password: {
      type: String,
      required: true,
      minLength: 8,
      select: false,
    },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Incremented on password change/reset to invalidate older JWTs.
    tokenVersion: { type: Number, default: 0, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // Alert preferences
    categories: {
      type: [{ type: String, enum: ALLOWED_CATEGORIES }],
      default: ['general'],
    },
    frequency: { type: String, enum: FREQUENCIES, default: 'daily' },
    channels: {
      email: { type: Boolean, default: true },
      browser: { type: Boolean, default: false },
    },
    // New accounts start unsubscribed; saving preferences turns alerts on.
    subscribed: { type: Boolean, default: false },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ subscribed: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.checkPassword = function checkPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** The only user fields ever sent to the browser. */
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
    preferences: {
      categories: this.categories,
      frequency: this.frequency,
      channels: {
        email: this.channels?.email ?? true,
        browser: this.channels?.browser ?? false,
      },
      subscribed: this.subscribed,
      lastSentAt: this.lastSentAt,
    },
  };
};

module.exports = mongoose.model('User', userSchema);
