const Category = require("../models/Category");

const createCategory = async (req, res) => {
  const { name, description } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Category name is required" });
  }

  if (description !== undefined && typeof description !== "string") {
    return res.status(400).json({ message: "Description must be a string" });
  }

  try {
    const category = await Category.create({
      name: name.trim(),
      description,
    });

    return res.status(201).json({
      message: "Category Created",
      id: category._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Category already exists" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    console.error("Unable to create category:", err.message);
    return res.status(500).json({ message: "Unable to create category" });
  }
};

module.exports = createCategory;
