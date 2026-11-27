const dns = require('dns');
const mongoose = require('mongoose');
const { env } = require('./env');

const fixLoopbackDns = () => {
  const current = dns.getServers();
  const onlyLoopback = current.every((s) => s === '127.0.0.1' || s === '::1');
  if (!onlyLoopback && !process.env.DNS_SERVERS) return;

  const servers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  dns.setServers(servers);
};

const connectDB = async () => {
  if (env.mongoUri.startsWith('mongodb+srv://')) fixLoopbackDns();
  await mongoose.connect(env.mongoUri);
  console.log('MongoDB connected');
};

module.exports = connectDB;
