const cron = require('node-cron');
const User = require('../models/User');
const { sendNewsAlertForUser } = require('../services/newsAlertService');

const FREQUENCY_MS = {
  immediate: 0,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

const runNewsAlertCheck = async () => {
  const users = await User.find({ subscribed: true });

  for (const user of users) {
    const interval = FREQUENCY_MS[user.frequency];
    const due =
      !user.lastSentAt || Date.now() - new Date(user.lastSentAt).getTime() >= interval;

    if (!due) continue;

    await sendNewsAlertForUser(user);
  }
};


const startNewsAlertJob = () => {
  cron.schedule('*/15 * * * *', () => {
    console.log('Running news alert check...');
    runNewsAlertCheck().catch((err) => console.error('News alert job failed:', err.message));
  });
};

module.exports = { startNewsAlertJob, runNewsAlertCheck };
