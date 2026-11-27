const AppError = require('../utils/AppError');
const { env } = require('../config/env');

const notFound = (req, res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/** Converts known library errors into AppErrors with sensible status codes. */
const normalize = (err) => {
  if (err instanceof AppError) return err;

  if (err.type === 'entity.parse.failed') {
    return AppError.badRequest('The request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'The request body is too large');
  }

  // Mongoose schema validation.
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, e.message])
    );
    return AppError.badRequest(Object.values(errors)[0] || 'Invalid data', { errors });
  }

  // Malformed ObjectId and similar.
  if (err.name === 'CastError') {
    return AppError.badRequest(`Invalid value for ${err.path}`);
  }

  // Unique index violation.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
    return AppError.conflict(
      field === 'email' ? 'An account with this email already exists' : 'This record already exists'
    );
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return AppError.unauthorized('Your session is not valid. Please log in again.');
  }

  return null;
};


const errorHandler = (err, req, res, next) => {
  const known = normalize(err);
  const status = known ? known.statusCode : 500;

  if (!known) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  } else if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}: ${status} ${known.message}`);
  }

  const body = {
    success: false,
    message: known ? known.message : 'Something went wrong on our side. Please try again.',
  };
  if (known && known.details) Object.assign(body, known.details);
  if (!env.isProduction && !known) body.stack = err.stack;

  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
