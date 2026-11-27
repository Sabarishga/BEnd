const Category = require('../models/Category');
const { ALLOWED_CATEGORIES } = require('../constants/newsCategories');

/** GET /api/categories - the categories users can subscribe to. */
const listCategories = async (req, res) => {
  res.json({ success: true, categories: ALLOWED_CATEGORIES });
};

const createCategory = async (req, res) => {
  const { name, description } = req.valid.body;
  const category = await Category.create({ name, description });
  res.status(201).json({ success: true, message: 'Category created', id: category._id });
};

module.exports = { listCategories, createCategory };
