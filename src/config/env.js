const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const toList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  newsApiKey: process.env.NEWS_API_KEY || '',
  clientUrls: toList(process.env.CLIENT_URL),
  newsCacheMinutes: Number(process.env.NEWS_CACHE_MINUTES) || 15,
  jobDebug: process.env.NEWS_JOB_DEBUG === 'true',
  runAlertOnStart: process.env.RUN_ALERT_ON_START === 'true',
};

env.primaryClientUrl = env.clientUrls[0] || 'http://localhost:5173';

const checkEnv = () => {
  const problems = [];

  if (!env.mongoUri) problems.push('MONGODB_URI is not set');
  else if (!/^mongodb(\+srv)?:\/\//i.test(env.mongoUri)) {
    problems.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  if (!env.jwtSecret) problems.push('JWT_SECRET is not set');
  else if (env.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters long');
  }

  if (problems.length) {
    throw new Error(
      `Invalid configuration:\n  - ${problems.join('\n  - ')}\n` +
        'Copy .env.example to .env and fill in the values (see README).'
    );
  }

  if (!env.newsApiKey) console.warn('[config] NEWS_API_KEY is not set: news cannot be fetched.');
  if (env.isProduction && !env.clientUrls.length) {
    console.warn('[config] CLIENT_URL is not set: browsers will be blocked by CORS.');
  }
};

module.exports = { env, checkEnv };
