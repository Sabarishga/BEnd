const express = require('express');
const auth = require('../Controllers/authController');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');
const { string, email, password, boolean } = require('../utils/rules');

const router = express.Router();

// Public
router.post(
  '/register',
  authLimiter,
  validate({
    name: [string({ required: true, min: 3, max: 50 }), 'Name'],
    email: [email(), 'Email'],
    password: [password(), 'Password'],
  }),
  asyncHandler(auth.register)
);

router.post(
  '/login',
  authLimiter,
  validate({
    email: [email(), 'Email'],
    // No strength rules on login: older accounts may have simpler passwords.
    password: [password({ checkStrength: false }), 'Password'],
  }),
  asyncHandler(auth.login)
);

router.post(
  '/forgot-password',
  authLimiter,
  validate({ email: [email(), 'Email'] }),
  asyncHandler(auth.forgotPassword)
);

router.post(
  '/reset-password',
  authLimiter,
  validate({
    email: [email(), 'Email'],
    token: [string({ required: true, min: 64, max: 64 }), 'Reset token'],
    password: [password(), 'New password'],
  }),
  asyncHandler(auth.resetPassword)
);

// Private
router.get('/me', protect, asyncHandler(auth.me));

router.post(
  '/logout',
  protect,
  validate({ allDevices: [boolean(), 'All devices'] }),
  asyncHandler(auth.logout)
);

router.post(
  '/change-password',
  protect,
  authLimiter,
  validate({
    currentPassword: [password({ checkStrength: false }), 'Current password'],
    password: [password(), 'New password'],
  }),
  asyncHandler(auth.changePassword)
);

module.exports = router;
