const { getFeed } = require('../services/newsService');

/**
 * GET /api/news?category=sports,technology
 * Public: news headlines are not private data. Several categories can be
 * requested at once; results are merged and sorted newest first.
 */
const getNews = async (req, res) => {
  const { category, limit } = req.valid.query;
  const feed = await getFeed(category, limit);
  res.json({ success: true, ...feed });
};

/** GET /api/news/headlines - a few general headlines for the public landing page. */
const getHeadlines = async (req, res) => {
  const feed = await getFeed(['general'], 6);
  res.json({ success: true, ...feed, articles: feed.articles.slice(0, 6) });
};

module.exports = { getNews, getHeadlines };
