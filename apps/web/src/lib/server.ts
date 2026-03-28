import { createDb, type Db } from "@open-gikai/db";
import { createAuth, type Auth } from "@open-gikai/auth";

let cfEnv: Cloudflare.Env | undefined;

try {
  const cf = await import("cloudflare:workers");
  cfEnv = cf.env;
} catch {}

// Cloudflare Workers では cfEnv が入るためこの分岐は通らない。ローカル開発でこの分岐に入る
if (!cfEnv) {
  // 動的import にすることで、Cloudflare バンドルで node:path / dotenv が評価されないようにするため。
  const [{ config: loadEnvFile }, path, { fileURLToPath }] = await Promise.all([
    import("dotenv"),
    import("node:path"),
    import("node:url"),
  ]);
  const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  loadEnvFile({ path: path.join(monorepoRoot, ".env.local"), override: true });
}

function getEnv(): Cloudflare.Env {
  if (cfEnv) return cfEnv;
  return {
    HYPERDRIVE: {
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:4030",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:4030",
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  } as unknown as Cloudflare.Env;
}

/**
 * Web アプリ用の DB 接続を取得する。
 */
export function getDb(): Db {
  return createDb(getEnv().HYPERDRIVE.connectionString);
}

/**
 * Web アプリ用の auth インスタンスを取得する。
 */
export function getAuth(): Auth {
  const e = getEnv();
  if (!e.RESEND_API_KEY) {
    console.warn("[auth] RESEND_API_KEY が未設定です。メール確認機能が動作しません。");
  }
  return createAuth({
    db: getDb(),
    trustedOrigins: e.CORS_ORIGIN,
    resendApiKey: e.RESEND_API_KEY,
  });
}
