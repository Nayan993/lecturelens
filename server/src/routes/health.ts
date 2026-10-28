import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import mongoose from 'mongoose';

// server/package.json — the same relative path from src/routes and dist/routes.
const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json');
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

export const healthRouter = Router();

/** GET /health — public liveness + DB state (docs/CONTRACTS.md §5.2). */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSec: Number(process.uptime().toFixed(3)),
    db: mongoose.connection.readyState === mongoose.ConnectionStates.connected ? 'connected' : 'not_connected',
    version,
    timestamp: new Date().toISOString(),
  });
});
