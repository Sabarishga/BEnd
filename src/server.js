const path = require('path');
const envPath = path.resolve(__dirname, '../.env');

require('dotenv').config({ path: envPath });
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const newsRoutes = require('./routes/newsRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const { startNewsAlertJob } = require('./jobs/newsJob');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', userRoutes);
app.use('/api', newsRoutes);
app.use('/api', categoryRoutes);

app.get('/', (req, res) => {
  res.send('News Alert API is running');
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  startNewsAlertJob();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer().catch((err) => {
  console.error('Unable to start server:', err.message);
  process.exit(1);
});
