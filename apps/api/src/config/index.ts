import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  MASTER_API_KEY: z.string().min(20),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  SESSION_BASE_DIR: z.string().default("./data/sessions"),

  HOURLY_MSG_LIMIT: z.coerce.number().default(60),
  DAILY_MSG_LIMIT: z.coerce.number().default(500),
  MIN_MSG_GAP_MS: z.coerce.number().default(3000),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),

  QR_WS_TIMEOUT_MS: z.coerce.number().default(300_000),
  QR_TOKEN_TTL_MS: z.coerce.number().default(120_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Geçersiz ortam değişkenleri:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
