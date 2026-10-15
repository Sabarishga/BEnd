const express = require("express");
const NewsArticle = require("../models/NewsArticle");
const { ALLOWED_CATEGORIES } = require("../constants/newsCategories");
const {
  fetchNewsByCategory,
  fetchFeaturedBitcoinNews,
} = require("../services/newsService");

const router = express.Router();

router.get("/news/featured", async (req, res) => {
  try {
    const articles = await fetchFeaturedBitcoinNews();
    return res.json(articles);
  } catch (err) {
    console.error("Failed to load featured news:", err.message);
    return res.status(502).json({ message: "Unable to load featured news" });
  }
});

router.get("/news", async (req, res) => {
  const category = typeof req.query.category === "string"
    ? req.query.category.trim().toLowerCase()
    : "";

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return res.status(400).json({
      message: `Invalid category. Allowed options: ${ALLOWED_CATEGORIES.join(", ")}`,
    });
  }

  try {
    await fetchNewsByCategory(category);

    const articles = await NewsArticle.find({ category })
      .sort({ publishedAt: -1 })
      .limit(50)
      .lean();
    return res.json(articles);
  } catch (err) {
    console.error(`Failed to load news for category "${category}":`, err.message);
    return res.status(502).json({ message: "Unable to load news for this category" });
  }
});

module.exports = router;
