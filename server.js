const { env, checkEnv } = require('./src/config/env');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const { startNewsAlertJob } = require('./src/jobs/newsJob');
const { verifyEmailSetup } = require('./src/services/emailService');

const startServer = async () => {
  checkEnv();
  await connectDB();
  app.listen(env.port, () => console.log(`Server running on port ${env.port}`));
  startNewsAlertJob();
  verifyEmailSetup();
};

startServer().catch((err) => {
  console.error('Unable to start server:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('[process] unhandled promise rejection:', err);
});
