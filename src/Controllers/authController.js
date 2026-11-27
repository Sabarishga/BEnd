const crypto = require('crypto');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { signToken } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/emailService');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const sendSession = (res, status, user, message) =>
  res.status(status).json({ success: true, message, token: signToken(user), user: user.toPublic() });

const register = async (req, res) => {
  const { name, email, password } = req.valid.body;

  if (await User.exists({ email })) {
    throw AppError.conflict('An account with this email already exists');
  }

  const user = await User.create({ name, email, password });
  sendSession(res, 201, user, 'Account created. Welcome!');
};

/** POST /api/auth/login */
const login = async (req, res) => {
  const { email, password } = req.valid.body;

  const user = await User.findOne({ email }).select('+password +tokenVersion');
  if (!user || !(await user.checkPassword(password))) {
    throw AppError.unauthorized('Invalid email or password');
  }
  sendSession(res, 200, user, 'Logged in');
};

/** GET /api/auth/me */
const me = async (req, res) => {
  res.json({ success: true, user: req.user.toPublic() });
};

/** POST /api/auth/logout */
const logout = async (req, res) => {
  if (req.valid.body.allDevices) {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  }
  res.json({ success: true, message: 'Logged out' });
};

/** POST /api/auth/change-password  (logged in) */
const changePassword = async (req, res) => {
  const { currentPassword, password } = req.valid.body;

  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!(await user.checkPassword(currentPassword))) {
    throw AppError.badRequest('Your current password is incorrect', {
      errors: { currentPassword: 'Your current password is incorrect' },
    });
  }
  if (currentPassword === password) {
    throw AppError.badRequest('The new password must be different from the current one');
  }

  user.password = password;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  sendSession(res, 200, user, 'Password changed');
};

/** POST /api/auth/forgot-password */
const forgotPassword = async (req, res) => {
  const { email } = req.valid.body;
  const user = await User.findOne({ email });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save({ validateModifiedOnly: true });

    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (err) {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateModifiedOnly: true });
      throw err;
    }
  }

  res.json({
    success: true,
    message: 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.',
  });
};

/** POST /api/auth/reset-password */
const resetPassword = async (req, res) => {
  const { email, token, password } = req.valid.body;

  const user = await User.findOne({
    email,
    passwordResetTokenHash: hashToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+password +passwordResetTokenHash +passwordResetExpires +tokenVersion');

  if (!user) throw AppError.badRequest('This reset link is invalid or has expired. Please request a new one.');

  user.password = password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  sendSession(res, 200, user, 'Password reset. You are now logged in.');
};

module.exports = { register, login, me, logout, changePassword, forgotPassword, resetPassword };
