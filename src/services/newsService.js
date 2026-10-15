const axios = require('axios');
const NewsArticle = require('../models/NewsArticle');

const fetchNewsByCategory = async (category) => {
  if (!process.env.NEWS_API_KEY || process.env.NEWS_API_KEY === 'your_newsapi_key_here') {
    throw new Error('NEWS_API_KEY must be configured');
  }

  const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
    params: {
      category,
      language: 'en',
      pageSize: 20,
      apiKey: process.env.NEWS_API_KEY,
    },
  });
  if (data.status !== 'ok') {
    throw new Error(data.message || 'News provider returned an unsuccessful response');
  }

  const articles = (data.articles || []).filter((article) => article.title && article.url);
  if (articles.length) {
    await NewsArticle.bulkWrite(
      articles.map((article) => ({
        updateOne: {
          filter: { category, url: article.url },
          update: {
            $set: {
              title: article.title,
              description: article.description,
              url: article.url,
              imageUrl: article.urlToImage,
              source: article.source,
              author: article.author,
              publishedAt: article.publishedAt,
              fetchedAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  return articles.map((article) => ({ ...article, category }));
};

const fetchFeaturedBitcoinNews = async () => {
  if (!process.env.NEWS_API_KEY || process.env.NEWS_API_KEY === 'your_newsapi_key_here') {
    throw new Error('NEWS_API_KEY must be configured');
  }

  const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
    params: {
      sources: 'bbc-news,the-verge',
      q: 'bitcoin',
      language: 'en',
      apiKey: process.env.NEWS_API_KEY,
    },
  });

  if (data.status !== 'ok') {
    throw new Error(data.message || 'News provider returned an unsuccessful response');
  }

  return data.articles || [];
};

module.exports = { fetchNewsByCategory, fetchFeaturedBitcoinNews };
