const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { env } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { getTransport } = require('./services/emailService');
const authRoutes = require('./routes/authRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const newsRoutes = require('./routes/newsRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed =
        env.clientUrls.includes(origin.replace(/\/+$/, '')) ||
        (!env.isProduction && (!env.clientUrls.length || /^http:\/\/localhost:\d+$/.test(origin)));
      return callback(null, allowed);
    },
  })
);

app.use(express.json({ limit: '20kb' }));

app.get('/', (req, res) => res.send('News Alert API is running'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    email: getTransport().type,
    newsApi: env.newsApiKey ? 'configured' : 'missing',
  });
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/categories', categoryRoutes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
