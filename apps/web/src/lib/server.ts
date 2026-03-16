import { createDb, type Db } from "@open-gikai/db";
import { createAuth, type Auth } from "@open-gikai/auth";
import { env } from "@open-gikai/env/server";
import { env as cfEnv } from "cloudflare:workers";

/**
 * Web アプリ用の DB 接続を取得する。
 * Hyperdrive 経由で接続する
 * Hyperdrive はリクエストごとに動的な接続文字列を返すため、毎回新しいクライアントを生成する。
 */
export function getDb(): Db {
  return createDb(cfEnv.HYPERDRIVE.connectionString);
}

let _auth: Auth | null = null;

/** Web アプリ用の auth インスタンス（遅延初期化） */
export function getAuth(): Auth {
  if (!_auth)
    _auth = createAuth({
      db: getDb(),
      trustedOrigins: env.CORS_ORIGIN,
    });
  return _auth;
}
