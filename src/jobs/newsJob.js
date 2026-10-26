const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { fetchNewsByCategory } = require('../services/newsService');
const { sendNewsAlertEmail } = require('../services/emailService');

// How long to wait between emails for each user setting.
// immediate = every check (once a minute), hourly = 60 min, daily = 24 h.
const FREQUENCY_MS = {
  immediate: 0,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

const MAX_ARTICLES_PER_EMAIL = 10;

// The job ticks once a minute. This tolerance absorbs cron jitter so an hourly
// user gets the email on the tick at exactly 60 min (not 61) without ever
// firing a minute early. Keep it at 30s while the job ticks every minute.
const TOLERANCE_MS = 30 * 1000;

// How often each category is re-fetched from the news provider.
// NewsAPI free plan = 100 requests/day TOTAL, so 1440 / minutes * categories must stay under 100.
// 15 min = 96/day for ONE category. Raise NEWS_CACHE_MINUTES (in .env) if users pick several categories.
const CACHE_TTL_MS = Number(process.env.NEWS_CACHE_MINUTES || 15) * 60 * 1000;
const FAIL_BACKOFF_MS = 5 * 60 * 1000; // after a failed fetch, wait before trying that category again

const cache = new Map(); // category -> { at, articles }
const failedAt = new Map(); // category -> timestamp of last failed fetch

const debug = (...args) => {
  if (process.env.NEWS_JOB_DEBUG === 'true') console.log(...args);
};

const getArticles = async (category) => {
  const hit = cache.get(category);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.articles;

  const lastFail = failedAt.get(category);
  if (lastFail && Date.now() - lastFail < FAIL_BACKOFF_MS) {
    if (hit) return hit.articles; // keep serving the last good copy
    throw new Error('recent fetch failure, retrying shortly');
  }

  try {
    const articles = await fetchNewsByCategory(category);
    cache.set(category, { at: Date.now(), articles });
    failedAt.delete(category);
    return articles;
  } catch (err) {
    failedAt.set(category, Date.now());
    if (hit) {
      console.error(`[newsJob] refresh of "${category}" failed, using older copy:`, err.message);
      return hit.articles;
    }
    throw err;
  }
};

const isDue = (user, runStartedAt) => {
  if (!user.lastSentAt) return true;
  const interval = FREQUENCY_MS[user.frequency] ?? FREQUENCY_MS.daily;
  return runStartedAt - new Date(user.lastSentAt).getTime() >= interval - TOLERANCE_MS;
};

let isRunning = false; // prevents two overlapping runs from sending duplicate emails

const runNewsAlertCheck = async () => {
  if (isRunning) {
    console.log('[newsJob] previous run still in progress, skipping this tick');
    return;
  }
  isRunning = true;
  const runStartedAt = Date.now(); // all timing decisions use the tick time, so there is no drift

  try {
    // Only users who are currently signed in receive alerts
    const users = await User.find({ subscribed: true, isLoggedIn: true });
    debug(`[newsJob] checking ${users.length} subscribed user(s)`);

    for (const user of users) {
      try {
        if (!isDue(user, runStartedAt)) {
          debug(`[newsJob] ${user.email}: not due yet (${user.frequency}, last sent ${user.lastSentAt})`);
          continue;
        }

        // Collect articles; a failure in one category must not stop the others
        const byUrl = new Map();
        for (const category of user.categories) {
          try {
            for (const a of await getArticles(category)) {
              if (!byUrl.has(a.url)) byUrl.set(a.url, { ...a, category });
            }
          } catch (err) {
            console.error(`[newsJob] could not fetch "${category}":`, err.message);
          }
        }

        const candidates = [...byUrl.values()];
        if (!candidates.length) {
          debug(`[newsJob] ${user.email}: no articles fetched`);
          continue;
        }

        // Only send articles this user hasn't already received
        const alreadySent = new Set(
          await Notification.find({
            user: user._id,
            url: { $in: candidates.map((a) => a.url) },
          }).distinct('url')
        );
        const articles = candidates
          .filter((a) => !alreadySent.has(a.url))
          .slice(0, MAX_ARTICLES_PER_EMAIL);

        if (!articles.length) {
          debug(`[newsJob] ${user.email}: nothing new to send`);
          continue;
        }

        try {
          await sendNewsAlertEmail(user.email, articles);
        } catch (err) {
          console.error(`[newsJob] email to ${user.email} FAILED:`, err.message);
          continue;
        }

        const sentAt = new Date(runStartedAt);
        await Notification.insertMany(
          articles.map((a) => ({
            user: user._id,
            title: a.title,
            description: a.description,
            url: a.url,
            category: a.category,
            sentAt,
          }))
        );
        await User.updateOne({ _id: user._id }, { lastSentAt: sentAt });
        console.log(`[newsJob] ${user.email}: sent ${articles.length} article(s) (${user.frequency})`);
      } catch (err) {
        // Never let one user break the loop for everyone else
        console.error(`[newsJob] error for ${user.email}:`, err.message);
      }
    }
  } finally {
    isRunning = false;
  }
};

const startNewsAlertJob = () => {
  // Every minute. Each user's own frequency decides whether an email is due.
  cron.schedule('* * * * *', () => {
    runNewsAlertCheck().catch((err) => console.error('[newsJob] job failed:', err.message));
  });
  console.log('[newsJob] scheduled: checks every minute');

  // For testing: set RUN_ALERT_ON_START=true in .env to run once at startup
  if (process.env.RUN_ALERT_ON_START === 'true') {
    runNewsAlertCheck().catch((err) => console.error('[newsJob] startup run failed:', err.message));
  }
};

module.exports = { startNewsAlertJob, runNewsAlertCheck };