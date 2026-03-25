import { createDb, type Db } from "@open-gikai/db-auth";
import { ShardedMinutesDb } from "@open-gikai/db-minutes";
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

let shardedMinutesDb: ShardedMinutesDb | undefined;

/**
 * シャーディングされた議事録 DB を返す。
 * manifest.json を読み込み、フィルタ条件に応じて適切なシャードを選択する。
 * インスタンスはキャッシュして再利用する。
 */
export function getMinutesDb(): ShardedMinutesDb {
  if (!shardedMinutesDb) {
    shardedMinutesDb = new ShardedMinutesDb(env.MINUTES_DB_DIR);
  }
  return shardedMinutesDb;
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
