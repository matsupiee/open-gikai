import { createDb, type Db } from "@open-gikai/db";
import { createAuth, type Auth } from "@open-gikai/auth";

let cfEnv: Cloudflare.Env | undefined;

try {
  // Cloudflare Workers 環境（本番 + miniflare）
  // @ts-expect-error cloudflare:workers は Cloudflare 環境でのみ利用可能
  const cf = await import("cloudflare:workers");
  cfEnv = cf.env;
} catch {
  // ローカル dev（Cloudflare plugin なし）
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
  return createAuth({
    db: getDb(),
    trustedOrigins: e.CORS_ORIGIN,
  });
}
