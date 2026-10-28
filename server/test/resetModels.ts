import mongoose from 'mongoose';

// Runs before test/setup.ts (vitest setupFiles order). In the single fork every test file
// re-evaluates src/ (so models re-register) while the mongoose module itself stays cached;
// clearing its registry first avoids OverwriteModelError without touching model code.
for (const name of mongoose.modelNames()) mongoose.deleteModel(name);
