const axios = require('axios');
const NewsArticle = require('../models/NewsArticle');
const AppError = require('../utils/AppError');
const { env } = require('../config/env');

const FAIL_BACKOFF_MS = 5 * 60 * 1000;
const cacheTtlMs = () => env.newsCacheMinutes * 60 * 1000;

const cache = new Map(); // category -> { at, articles }
const failedAt = new Map(); // category -> timestamp of last failed fetch
const inFlight = new Map(); // category -> pending fetch promise

const normalize = (article, category) => ({
  title: article.title,
  description: article.description || '',
  url: article.url,
  imageUrl: article.urlToImage || null,
  source: { id: article.source?.id || null, name: article.source?.name || '' },
  author: article.author || null,
  publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
  category,
});

const fetchFromProvider = async (category) => {
  if (!env.newsApiKey) throw new Error('NEWS_API_KEY is not configured');

  const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
    params: { category, language: 'en', pageSize: 30, apiKey: env.newsApiKey },
    timeout: 15000,
  });
  if (data.status !== 'ok') {
    throw new Error(data.message || 'News provider returned an unsuccessful response');
  }

  const articles = (data.articles || [])
    .filter((a) => a.title && a.url && a.title !== '[Removed]')
    .map((a) => normalize(a, category));

  if (articles.length) {
    await NewsArticle.bulkWrite(
      articles.map((a) => ({
        updateOne: {
          filter: { category, url: a.url },
          update: { $set: { ...a, fetchedAt: new Date() } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }
  return articles;
};

/**
 * Current top headlines for a category */
const getLatestArticles = async (category) => {
  const hit = cache.get(category);
  if (hit && Date.now() - hit.at < cacheTtlMs()) return hit.articles;

  const lastFail = failedAt.get(category);
  if (lastFail && Date.now() - lastFail < FAIL_BACKOFF_MS) {
    if (hit) return hit.articles;
    throw new Error('the news provider failed recently, retrying shortly');
  }

  if (!inFlight.has(category)) {
    inFlight.set(
      category,
      fetchFromProvider(category)
        .then((articles) => {
          cache.set(category, { at: Date.now(), articles });
          failedAt.delete(category);
          return articles;
        })
        .catch((err) => {
          failedAt.set(category, Date.now());
          const detail = err.response?.data?.message || err.message;
          console.error(`[news] fetching "${category}" failed: ${detail}`);
          if (hit) return hit.articles;
          throw err;
        })
        .finally(() => inFlight.delete(category))
    );
  }
  return inFlight.get(category);
};

/**
 * Articles for the in-app feed. Refreshes from the provider */
const getFeed = async (categories, limitPerCategory = 30) => {
  let stale = false;
  await Promise.all(
    categories.map((category) =>
      getLatestArticles(category).catch(() => {
        stale = true;
      })
    )
  );

  const lists = await Promise.all(
    categories.map((category) =>
      NewsArticle.find({ category })
        .sort({ publishedAt: -1 })
        .limit(limitPerCategory)
        .select('-__v -createdAt -updatedAt')
        .lean()
    )
  );

  const byUrl = new Map();
  for (const article of lists.flat()) {
    if (!byUrl.has(article.url)) byUrl.set(article.url, article);
  }
  const articles = [...byUrl.values()].sort(
    (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
  );

  if (!articles.length && stale) {
    throw new AppError(502, 'The news service is not responding right now. Please try again soon.');
  }
  return { articles, stale, updatedAt: new Date().toISOString() };
};

module.exports = { getLatestArticles, getFeed };
