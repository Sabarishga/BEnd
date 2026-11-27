const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { ALLOWED_CATEGORIES } = require('../constants/newsCategories');
const { deliverAlert } = require('../services/alertService');
const { sendTestEmail } = require('../services/emailService');

/**
 * GET /api/notifications
 * The logged-in user's alert history: filter by category and date, sort, paginate.
 */
const listNotifications = async (req, res) => {
  const { category = [], sort = 'newest', from, to, since, page, limit } = req.valid.query;

  const filter = { user: req.user._id };
  if (category.length) filter.category = { $in: category };
  if (from || to || since) {
    filter.sentAt = {};
    if (from) filter.sentAt.$gte = from;
    if (to) filter.sentAt.$lte = to;
    if (since) filter.sentAt.$gt = since;
  }

  const direction = sort === 'oldest' ? 1 : -1;
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ sentAt: direction, _id: direction })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-user -__v -updatedAt')
      .lean(),
    Notification.countDocuments(filter),
  ]);

  res.json({
    success: true,
    notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

/** GET /api/notifications/summary */
const getSummary = async (req, res) => {
  const byCategory = await Notification.aggregate([
    { $match: { user: req.user._id } },
    { $group: { _id: '$category', count: { $sum: 1 }, lastSentAt: { $max: '$sentAt' } } },
    { $sort: { count: -1 } },
  ]);

  const total = byCategory.reduce((sum, item) => sum + item.count, 0);
  const lastSentAt = byCategory.reduce(
    (latest, item) => (!latest || item.lastSentAt > latest ? item.lastSentAt : latest),
    null
  );

  res.json({
    success: true,
    total,
    lastSentAt,
    categories: byCategory.map((item) => ({
      category: item._id || 'uncategorized',
      count: item.count,
      lastSentAt: item.lastSentAt,
    })),
    allowedCategories: ALLOWED_CATEGORIES,
  });
};

/** DELETE /api/notifications */
const clearNotifications = async (req, res) => {
  const { deletedCount } = await Notification.deleteMany({ user: req.user._id });
  res.json({ success: true, message: 'Notification history cleared', deleted: deletedCount });
};


const sendTestAlert = async (req, res) => {
  const user = req.user;
  if (!user.channels.email && !user.channels.browser) {
    throw AppError.badRequest('Turn on email or browser alerts first');
  }

  const result = await deliverAlert(user, { ignoreSchedule: true });

  if (result.status === 'failed') throw result.error;
  if (result.emailError) {
    return res.status(207).json({
      success: false,
      status: result.status,
      count: result.count,
      channels: result.channels,
      message: `Delivered ${result.count} new stories as browser alerts, but the email could not be sent.`,
    });
  }

  if (result.status === 'nothing-new') {
    if (user.channels.email) await sendTestEmail(user.email);
    return res.json({
      success: true,
      status: result.status,
      count: 0,
      message: user.channels.email
        ? `No new stories since your last alert, so we sent a short test email to ${user.email}.`
        : 'No new stories since your last alert. New stories will appear as soon as they are published.',
    });
  }

  res.json({
    success: true,
    status: result.status,
    count: result.count,
    channels: result.channels,
    message: result.channels.includes('email')
      ? `Sent ${result.count} new ${result.count === 1 ? 'story' : 'stories'} to ${user.email}. Check your inbox (and spam folder).`
      : `Delivered ${result.count} new ${result.count === 1 ? 'story' : 'stories'} as browser alerts.`,
  });
};

module.exports = { listNotifications, getSummary, clearNotifications, sendTestAlert };
