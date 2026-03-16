import dotenv from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env" });

export const env = createEnv({
  server: {
    // web は Hyperdrive 経由で DB 接続するため DATABASE_URL 不要。
    // scraper-worker や seed スクリプトでは引き続き必要なので optional にしている。
    DATABASE_URL: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    OPENAI_API_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
