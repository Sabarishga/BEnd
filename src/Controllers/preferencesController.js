const AppError = require('../utils/AppError');

/** GET /api/preferences */
const getPreferences = async (req, res) => {
  res.json({ success: true, preferences: req.user.toPublic().preferences });
};

/**
 * PUT /api/preferences */
const updatePreferences = async (req, res) => {
  const { categories, frequency, channels } = req.valid.body;
  const user = req.user;

  if (categories) user.categories = categories;
  if (frequency) user.frequency = frequency;
  if (channels) {
    if (channels.email !== undefined) user.channels.email = channels.email;
    if (channels.browser !== undefined) user.channels.browser = channels.browser;
  }
  if (!user.channels.email && !user.channels.browser) {
    throw AppError.badRequest('Choose at least one way to receive alerts (email or browser)');
  }
  user.subscribed = true;

  await user.save();
  res.json({
    success: true,
    message: 'Preferences saved. Alerts are on.',
    preferences: user.toPublic().preferences,
  });
};

/** POST /api/preferences/unsubscribe */
const unsubscribe = async (req, res) => {
  req.user.subscribed = false;
  await req.user.save();
  res.json({
    success: true,
    message: 'Alerts are off. Your topics are kept, so you can turn alerts back on any time.',
    preferences: req.user.toPublic().preferences,
  });
};

module.exports = { getPreferences, updatePreferences, unsubscribe };
