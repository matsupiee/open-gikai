import { createDb, type Db } from "@open-gikai/db-auth";
import { createDb as createMinutesDb, type Db as MinutesDb } from "@open-gikai/db-minutes";
import { createAuth, type Auth } from "@open-gikai/auth";
import { env } from "cloudflare:workers";

/**
 * Web アプリ用の DB 接続を取得する。
 * Hyperdrive 経由で接続する
 * Hyperdrive はリクエストごとに動的な接続文字列を返すため、毎回新しいクライアントを生成する。
 */
export function getDb(): Db {
  return createDb(env.HYPERDRIVE.connectionString);
}

export function getMinutesDb(): MinutesDb {
  return createMinutesDb(env.MINUTES_DB_PATH);
}

/**
 * Web アプリ用の auth インスタンスを取得する。
 * Hyperdrive の接続文字列はリクエストごとに変わるため、毎回新しい DB で生成する。
 */
export function getAuth(): Auth {
  return createAuth({
    db: getDb(),
    trustedOrigins: env.CORS_ORIGIN,
  });
}
