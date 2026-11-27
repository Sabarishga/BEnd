const cron = require('node-cron');
const User = require('../models/User');
const { deliverAlert } = require('../services/alertService');
const { env } = require('../config/env');

const debug = (...args) => {
  if (env.jobDebug) console.log(...args);
};

let isRunning = false;

const runNewsAlertCheck = async () => {
  if (isRunning) {
    console.log('[newsJob] previous run still in progress, skipping this tick');
    return;
  }
  isRunning = true;
  const now = Date.now();

  try {
    const users = await User.find({ subscribed: true });
    debug(`[newsJob] checking ${users.length} subscribed user(s)`);

    for (const user of users) {
      try {
        const result = await deliverAlert(user, { now });
        if (result.status === 'sent') {
          console.log(
            `[newsJob] ${user.email}: sent ${result.count} article(s) via ${result.channels.join(' + ')}`
          );
        } else if (result.status === 'failed') {
          console.error(`[newsJob] ${user.email}: delivery FAILED (${result.error?.message})`);
        } else {
          debug(`[newsJob] ${user.email}: ${result.status}`);
        }
      } catch (err) {
        console.error(`[newsJob] error for ${user.email}:`, err.message);
      }
    }
  } finally {
    isRunning = false;
  }
};

const startNewsAlertJob = () => {
  cron.schedule('* * * * *', () => {
    runNewsAlertCheck().catch((err) => console.error('[newsJob] run failed:', err.message));
  });
  console.log('[newsJob] scheduled: checks every minute');

  if (env.runAlertOnStart) {
    runNewsAlertCheck().catch((err) => console.error('[newsJob] startup run failed:', err.message));
  }
};

module.exports = { startNewsAlertJob, runNewsAlertCheck };
