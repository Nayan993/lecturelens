import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isDev } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

/** The Express app, without a network listener (see index.ts) so tests can use it directly. */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, exposedHeaders: ['X-Request-Id'] }));
  // requestId runs first so every later log line (morgan included) carries the id;
  // morgan runs before the body parsers so requests with malformed bodies are logged too.
  app.use(requestId);
  if (isDev) {
    app.use(
      morgan(':method :url :status :response-time ms - :res[content-length]', {
        stream: { write: (line) => logger.info(line.trim(), { source: 'http' }) },
      }),
    );
  }
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
