const express = require('express');
const { listCategories, createCategory } = require('../Controllers/categoryController');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { string } = require('../utils/rules');

const router = express.Router();

router.get('/', asyncHandler(listCategories));

// Admins only
router.post(
  '/',
  protect,
  authorize('admin'),
  validate({
    name: [string({ required: true, min: 2, max: 40 }), 'Name'],
    description: [string({ max: 200 }), 'Description'],
  }),
  asyncHandler(createCategory)
);

module.exports = router;
