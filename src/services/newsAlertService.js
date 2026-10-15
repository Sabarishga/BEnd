const Notification = require('../models/Notification');
const { fetchNewsByCategory } = require('./newsService');
const { sendNewsAlertEmail } = require('./emailService');

const sendNewsAlertForUser = async (user) => {
  let articles = [];
  for (const category of user.categories) {
    const categoryArticles = await fetchNewsByCategory(category);
    articles = articles.concat(
      categoryArticles.map((article) => ({ ...article, category }))
    );
  }

  if (!articles.length) return false;

  await sendNewsAlertEmail(user.email, articles);

  user.lastSentAt = new Date();
  await user.save();

  await Notification.insertMany(
    articles.map((article) => ({
      user: user._id,
      title: article.title,
      description: article.description,
      url: article.url,
      category: article.category,
    }))
  );

  return true;
};

module.exports = { sendNewsAlertForUser };
