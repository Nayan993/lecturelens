import { app } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/connect.js';
import { failInterruptedLectures } from './services/processing/pipeline.js';
import { logger } from './utils/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  await connectDb();
  // No job queue to resume from (CONTRACTS.md §2): lectures left mid-pipeline are failed.
  await failInterruptedLectures();

  const server = app.listen(env.PORT, () => {
    logger.info('LectureLens API listening', {
      url: `http://localhost:${env.PORT}/api/v1`,
      nodeEnv: env.NODE_ENV,
    });
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { signal });

    // Do not hang forever on keep-alive sockets or a stuck driver.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close((closeErr) => {
      if (closeErr) logger.error('Error closing HTTP server', { error: closeErr });
      else logger.info('HTTP server closed');
      disconnectDb()
        .then(() => process.exit(closeErr ? 1 : 0))
        .catch((err: unknown) => {
          logger.error('Error closing MongoDB connection', { error: err });
          process.exit(1);
        });
    });
    server.closeIdleConnections();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: reason });
});

main().catch((err: unknown) => {
  logger.error('Server failed to start', { error: err });
  process.exit(1);
});
