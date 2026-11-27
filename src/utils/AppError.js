class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (details) this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = 'Please log in to continue') {
    return new AppError(401, message);
  }

  static forbidden(message = 'You do not have permission to do that') {
    return new AppError(403, message);
  }

  static notFound(message = 'Not found') {
    return new AppError(404, message);
  }

  static conflict(message) {
    return new AppError(409, message);
  }

  static unavailable(message) {
    return new AppError(503, message);
  }
}

module.exports = AppError;
