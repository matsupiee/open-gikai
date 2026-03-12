import { createDb, type Db } from "@open-gikai/db";
import { createAuth, type Auth } from "@open-gikai/auth";
import { env } from "@open-gikai/env/server";

let _db: Db | null = null;
let _auth: Auth | null = null;

/** Web アプリ用の DB 接続（遅延初期化） */
export function getDb(): Db {
  if (!_db) _db = createDb(env.DATABASE_URL);
  return _db;
}

/** Web アプリ用の auth インスタンス（遅延初期化） */
export function getAuth(): Auth {
  if (!_auth)
    _auth = createAuth({
      db: getDb(),
      trustedOrigins: env.CORS_ORIGIN,
    });
  return _auth;
}
