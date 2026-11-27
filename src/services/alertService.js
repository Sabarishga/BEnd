const Notification = require('../models/Notification');
const User = require('../models/User');
const { getLatestArticles } = require('./newsService');
const { sendNewsAlertEmail } = require('./emailService');

const FREQUENCY_MS = {
  immediate: 0,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};
const MAX_ARTICLES_PER_ALERT = 10;
const TOLERANCE_MS = 30 * 1000;

const isDue = (user, now) => {
  if (!user.lastSentAt) return true;
  const interval = FREQUENCY_MS[user.frequency] ?? FREQUENCY_MS.daily;
  return now - new Date(user.lastSentAt).getTime() >= interval - TOLERANCE_MS;
};

/** Up to 10 articles from the user's categories that they have not received yet. */
const findNewArticles = async (user) => {
  const byUrl = new Map();
  for (const category of user.categories) {
    try {
      for (const article of await getLatestArticles(category)) {
        if (!byUrl.has(article.url)) byUrl.set(article.url, article);
      }
    } catch (err) {
      console.error(`[alerts] could not load "${category}" for ${user.email}: ${err.message}`);
    }
  }

  const candidates = [...byUrl.values()];
  if (!candidates.length) return [];

  const alreadySent = new Set(
    await Notification.find({
      user: user._id,
      url: { $in: candidates.map((a) => a.url) },
    }).distinct('url')
  );

  return candidates
    .filter((a) => !alreadySent.has(a.url))
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, MAX_ARTICLES_PER_ALERT);
};

const deliverAlert = async (user, { now = Date.now(), ignoreSchedule = false } = {}) => {
  if (!ignoreSchedule && !isDue(user, now)) return { status: 'not-due', count: 0, channels: [] };

  const wantsEmail = user.channels?.email !== false;
  const wantsBrowser = user.channels?.browser === true;
  if (!wantsEmail && !wantsBrowser) return { status: 'no-channel', count: 0, channels: [] };

  const articles = await findNewArticles(user);
  if (!articles.length) return { status: 'nothing-new', count: 0, channels: [] };

  const channels = [];
  let emailError = null;
  if (wantsEmail) {
    try {
      await sendNewsAlertEmail(user.email, articles);
      channels.push('email');
    } catch (err) {
      emailError = err;
    }
  }
  if (wantsBrowser) channels.push('browser');

  if (!channels.length) {
    return { status: 'failed', count: 0, channels: [], error: emailError };
  }

  const sentAt = new Date(now);
  await Notification.insertMany(
    articles.map((a) => ({
      user: user._id,
      title: a.title,
      description: a.description,
      url: a.url,
      imageUrl: a.imageUrl,
      source: a.source?.name,
      category: a.category,
      channels,
      sentAt,
    }))
  );
  await User.updateOne({ _id: user._id }, { lastSentAt: sentAt });

  return { status: 'sent', count: articles.length, channels, emailError };
};

module.exports = { deliverAlert, isDue, FREQUENCY_MS };
