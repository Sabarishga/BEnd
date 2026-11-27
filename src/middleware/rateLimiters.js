const { rateLimit } = require('express-rate-limit');

const limiter = (windowMinutes, limit, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, message }),
  });

/** Every /api request: generous, just stops abuse. */
const apiLimiter = limiter(15, 600, 'Too many requests. Please slow down and try again shortly.');

/** Login, register, forgot/reset password: protects against password guessing. */
const authLimiter = limiter(
  15,
  20,
  'Too many attempts. Please wait 15 minutes and try again.'
);

/** "Send me a test alert" sends real email, so keep it low. */
const testAlertLimiter = limiter(
  15,
  5,
  'You have sent several test alerts recently. Please wait a few minutes.'
);

module.exports = { apiLimiter, authLimiter, testAlertLimiter };
