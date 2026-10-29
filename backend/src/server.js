import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { runDueSchedules } from './services/bulkPricing.service.js';
import { getSettings } from './services/settings.service.js';
import { seedDatabase } from './seed/seed.js';
import { Product } from './models/Product.js';

async function main() {
  const { inMemory } = await connectDB();
  await getSettings({ fresh: true });
  // An in-memory database starts empty, so fill it with demo data automatically
  if (inMemory && !(await Product.exists({}))) await seedDatabase({ demoOrders: true });

  const app = createApp();
  const server = app.listen(env.port, () => logger.info(`API listening on http://localhost:${env.port}`));

  const timer = setInterval(() => runDueSchedules().catch((err) => logger.error({ err }, 'Scheduler error')), 60_000);

  const shutdown = async (sig) => {
    logger.info(`${sig} received, shutting down`);
    clearInterval(timer);
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
