const { ALLOWED_CATEGORIES, FREQUENCIES } = require('../constants/newsCategories');

class RuleError extends Error {}

const fail = (message) => {
  throw new RuleError(message);
};

const isMissing = (value) => value === undefined || value === null || value === '';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const string = ({ required = false, min = 0, max = Infinity, trim = true } = {}) =>
  (value, label) => {
    if (isMissing(value)) {
      if (required) fail(`${label} is required`);
      return undefined;
    }
    if (typeof value !== 'string') fail(`${label} must be text`);
    const clean = trim ? value.trim() : value;
    if (required && !clean) fail(`${label} is required`);
    if (clean.length < min || clean.length > max) {
      fail(
        max === Infinity
          ? `${label} must be at least ${min} characters`
          : `${label} must be between ${min} and ${max} characters`
      );
    }
    return clean;
  };

const email = ({ required = true } = {}) => (value, label) => {
  if (isMissing(value)) {
    if (required) fail(`${label} is required`);
    return undefined;
  }
  if (typeof value !== 'string') fail(`${label} must be text`);
  const clean = value.trim().toLowerCase();
  if (clean.length > 254 || !EMAIL_RE.test(clean)) fail(`${label} must be a valid email address`);
  return clean;
};

// bcrypt only looks at the first 72 bytes, so longer passwords are rejected.
const password = ({ required = true, checkStrength = true } = {}) => (value, label) => {
  if (isMissing(value)) {
    if (required) fail(`${label} is required`);
    return undefined;
  }
  if (typeof value !== 'string') fail(`${label} must be text`);
  if (Buffer.byteLength(value, 'utf8') > 72) fail(`${label} must be at most 72 bytes long`);
  if (checkStrength) {
    if (value.length < 8) fail(`${label} must be at least 8 characters`);
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
      fail(`${label} must contain at least one letter and one number`);
    }
  }
  return value;
};

const oneOf = (allowed, { required = false } = {}) => (value, label) => {
  if (isMissing(value)) {
    if (required) fail(`${label} is required`);
    return undefined;
  }
  const clean = typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (!allowed.includes(clean)) fail(`${label} must be one of: ${allowed.join(', ')}`);
  return clean;
};

const categories = ({ required = false, allowEmpty = false } = {}) => (value, label) => {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required`);
    return undefined;
  }
  const list = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(list)) fail(`${label} must be a list of categories`);
  const clean = [];
  for (const item of list) {
    if (typeof item !== 'string') fail(`${label} must be a list of categories`);
    const category = item.trim().toLowerCase();
    if (!category) continue;
    if (!ALLOWED_CATEGORIES.includes(category)) {
      fail(`"${category}" is not a valid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`);
    }
    if (!clean.includes(category)) clean.push(category);
  }
  if (!clean.length && !allowEmpty) fail('Choose at least one news category');
  return clean;
};

const frequency = (options) => oneOf(FREQUENCIES, options);

const boolean = ({ required = false } = {}) => (value, label) => {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required`);
    return undefined;
  }
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fail(`${label} must be true or false`);
};

const integer = ({ min = -Infinity, max = Infinity, fallback } = {}) => (value, label) => {
  if (isMissing(value)) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) fail(`${label} must be a whole number of at least ${min}`);
  return Math.min(n, max);
};

const date = () => (value, label) => {
  if (isMissing(value)) return undefined;
  if (typeof value !== 'string') fail(`${label} must be a date`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(`${label} must be a valid date (e.g. 2026-10-25)`);
  return parsed;
};

/** Validates a nested object such as `channels: { email, browser }`. */
const object = (shape, { required = false } = {}) => (value, label) => {
  if (value === undefined || value === null) {
    if (required) fail(`${label} is required`);
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  const clean = {};
  for (const [key, [rule, childLabel]] of Object.entries(shape)) {
    const result = rule(value[key], childLabel);
    if (result !== undefined) clean[key] = result;
  }
  return clean;
};

module.exports = {
  RuleError,
  string,
  email,
  password,
  oneOf,
  categories,
  frequency,
  boolean,
  integer,
  date,
  object,
};
