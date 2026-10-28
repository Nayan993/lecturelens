import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const RETRIES = 3;
const BASE_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connects to MongoDB, retrying 3 times with exponential backoff (1s, 2s, 4s).
 * Logs the database NAME only — the URI contains credentials and is never logged.
 * Exits the process if every attempt fails.
 */
export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 10,
        autoIndex: env.NODE_ENV !== 'production',
      });
      logger.info('MongoDB connected', { database: mongoose.connection.name });
      return;
    } catch (err) {
      // Driver messages can echo the host but not credentials; log only name + message.
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (attempt > RETRIES) {
        logger.error(
          `MongoDB connection failed after ${attempt} attempts; exiting. Check MONGODB_URI, network access and the Atlas IP allow-list.`,
          { reason },
        );
        process.exit(1);
      }
      const delayMs = BASE_DELAY_MS * 2 ** (attempt - 1);
      logger.warn('MongoDB connection attempt failed; retrying', {
        attempt,
        retryInMs: delayMs,
        reason,
      });
      await sleep(delayMs);
    }
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}
