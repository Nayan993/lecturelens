import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from './connect.js';
import { DEMO_PASSWORD, DEMO_USERS, buildSeed } from './seedData.js';

/**
 * `npm run seed --workspace server` — loads the shared /mocks fixtures plus the demo
 * accounts (CONTRACTS.md §9) into MongoDB.
 *
 * IDEMPOTENT: every collection it seeds is emptied and then refilled with the same
 * documents (same ids), so running it twice leaves identical counts. Collections it does
 * not seed (revisionrecommendations, llmcache) are left untouched.
 */
async function seed(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV=production. Demo accounts must never exist in production.');
    process.exit(1);
  }

  const collections = await buildSeed();

  // Validate everything before touching the database, so a bad fixture changes nothing.
  for (const { model, docs } of collections) {
    for (const doc of docs) {
      try {
        await doc.validate();
      } catch (err) {
        throw new Error(`${model.modelName} ${String(doc._id)} is invalid: ${(err as Error).message}`);
      }
    }
  }

  await connectDb();
  // Build every model's indexes (unique ones included) before inserting.
  // (seedData imports models/index.ts, so every model is registered by now.)
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));

  const rows: Array<{ collection: string; removed: number; inserted: number }> = [];
  for (const { model, docs } of collections) {
    const { deletedCount } = await model.deleteMany({});
    // Raw insert keeps the fixtures' own createdAt/updatedAt (Model.insertMany would
    // stamp "now"), so the database matches /mocks exactly. Documents were validated above.
    const raw = docs.map((d) => ({ ...d.toObject({ transform: false, virtuals: false }), __v: 0 }));
    const { insertedCount } = await model.collection.insertMany(raw);
    rows.push({ collection: model.collection.collectionName, removed: deletedCount, inserted: insertedCount });
  }

  console.log(`\nSeeded database "${mongoose.connection.name}":`);
  console.table(rows);

  console.log('Demo accounts (development only — CONTRACTS.md §9):');
  console.table(DEMO_USERS.map(({ role, name, email }) => ({ role, name, email, password: DEMO_PASSWORD })));

  await disconnectDb();
}

seed().catch(async (err: unknown) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
