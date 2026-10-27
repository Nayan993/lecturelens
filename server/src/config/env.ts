import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Environment schema. Secrets must come from the environment — never hardcode.
 * Required for the app to boot: MONGODB_URI, JWT_SECRET.
 * External API keys are optional at this stage (features that need them come later).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  ASSEMBLYAI_API_KEY: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),
  OPENROUTER_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  LLM_MODEL: z.string().min(1).default('llama-3.3-70b-versatile'),
  EMBEDDING_MODEL: z.string().min(1).default('Xenova/all-MiniLM-L6-v2'),
  STORAGE_DIR: z.string().min(1).default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(512),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  console.error('\n❌ Invalid environment configuration. Fix these variables:\n');
  console.error(problems.join('\n'));
  console.error('\nSee server/.env.example for the full list of expected variables.\n');
  process.exit(1);
}

export const env: Env = parsed.data;
