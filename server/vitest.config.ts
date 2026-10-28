import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests never read server/.env or touch Atlas: these win over .env (dotenv does not
    // override variables that are already set). DB tests start mongodb-memory-server.
    env: {
      NODE_ENV: 'test',
      PORT: '5000',
      CLIENT_ORIGIN: 'http://localhost:5173',
      MONGODB_URI: 'mongodb://127.0.0.1:1/unused-tests-use-mongodb-memory-server',
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters',
      JWT_EXPIRES_IN: '1h',
      STORAGE_DIR: path.join(os.tmpdir(), 'lecturelens-test-storage'),
      MAX_UPLOAD_MB: '512',
    },
    hookTimeout: 120_000, // the first run downloads the mongod binary
  },
});
