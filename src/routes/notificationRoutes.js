const express = require('express');
const notifications = require('../Controllers/notificationController');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { testAlertLimiter } = require('../middleware/rateLimiters');
const { categories, oneOf, integer, date } = require('../utils/rules');

const router = express.Router();

// Everything here works on the logged-in user only.
router.use(protect);

router.get(
  '/',
  validate(
    {
      category: [categories({ allowEmpty: true }), 'Category'],
      sort: [oneOf(['newest', 'oldest']), 'Sort'],
      from: [date(), 'From'],
      to: [date(), 'To'],
      since: [date(), 'Since'],
      page: [integer({ min: 1, fallback: 1 }), 'Page'],
      limit: [integer({ min: 1, max: 100, fallback: 20 }), 'Limit'],
    },
    'query'
  ),
  asyncHandler(notifications.listNotifications)
);

router.get('/summary', asyncHandler(notifications.getSummary));
router.delete('/', asyncHandler(notifications.clearNotifications));
router.post('/test', testAlertLimiter, asyncHandler(notifications.sendTestAlert));

module.exports = router;
