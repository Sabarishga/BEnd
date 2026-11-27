const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');

/** Creates a signed access token for a user. */
const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), v: user.tokenVersion || 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw AppError.unauthorized();
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw AppError.unauthorized(
      err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Your session is not valid. Please log in again.'
    );
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  // Changing or resetting the password bumps tokenVersion, which signs out
  if (!user || (user.tokenVersion || 0) !== payload.v) {
    throw AppError.unauthorized('Your session is no longer valid. Please log in again.');
  }

  req.user = user;
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(AppError.forbidden());
  }
  return next();
};

module.exports = { signToken, protect, authorize };
