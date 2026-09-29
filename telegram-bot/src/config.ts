import { z } from 'zod';
import 'dotenv/config';

export const env = z.object({
  BOT_TOKEN: z.string().min(10),
  ADMIN_IDS: z.string().transform(s => s.split(',').map(Number).filter(n => !isNaN(n))),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:1.5b'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(20),
  PRINT_AGENT_URL: z.string().url().default('http://localhost:8787'),
}).parse(process.env);

export const ADMIN_SET = new Set(env.ADMIN_IDS);