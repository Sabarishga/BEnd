const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI or MONGO_URI must be set to a MongoDB connection string');
  }
  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
    throw new Error('MONGODB_URI or MONGO_URI must be a valid MongoDB connection string');
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
};

module.exports = connectDB;
