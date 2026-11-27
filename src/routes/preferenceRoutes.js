const express = require('express');
const prefs = require('../Controllers/preferencesController');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { categories, frequency, boolean, object } = require('../utils/rules');

const router = express.Router();

// Everything here works on the logged-in user only.
router.use(protect);

router.get('/', asyncHandler(prefs.getPreferences));

router.put(
  '/',
  validate({
    categories: [categories({ required: true }), 'Categories'],
    frequency: [frequency({ required: true }), 'Frequency'],
    channels: [
      object({
        email: [boolean(), 'Email alerts'],
        browser: [boolean(), 'Browser alerts'],
      }),
      'Channels',
    ],
  }),
  asyncHandler(prefs.updatePreferences)
);

router.post('/unsubscribe', asyncHandler(prefs.unsubscribe));

module.exports = router;
