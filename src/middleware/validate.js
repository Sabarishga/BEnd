const AppError = require('../utils/AppError');
const { RuleError } = require('../utils/rules');


const validate = (schema, source = 'body') => (req, res, next) => {
  const input = req[source] || {};
  const clean = {};
  const errors = {};

  for (const [field, [rule, label]] of Object.entries(schema)) {
    try {
      const value = rule(input[field], label);
      if (value !== undefined) clean[field] = value;
    } catch (err) {
      if (!(err instanceof RuleError)) return next(err);
      errors[field] = err.message;
    }
  }

  const messages = Object.values(errors);
  if (messages.length) {
    return next(AppError.badRequest(messages[0], { errors }));
  }

  req.valid = { ...req.valid, [source]: clean };
  return next();
};

module.exports = validate;
