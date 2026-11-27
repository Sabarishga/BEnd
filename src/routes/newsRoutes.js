const express = require('express');
const news = require('../Controllers/newsController');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { categories, integer } = require('../utils/rules');

const router = express.Router();

// Public: anyone can read headlines, including visitors on the landing page.
router.get('/headlines', asyncHandler(news.getHeadlines));

router.get(
  '/',
  validate(
    {
      category: [categories({ required: true }), 'Category'],
      limit: [integer({ min: 1, max: 50, fallback: 30 }), 'Limit'],
    },
    'query'
  ),
  asyncHandler(news.getNews)
);

module.exports = router;
