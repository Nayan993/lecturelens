import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** A throwaway real mongod per test file (never Atlas, never server/.env). */
let mongod: MongoMemoryServer | undefined;

export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'lecturelens-test' });
  // Build indexes (unique ones included) before tests rely on them.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}
