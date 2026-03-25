import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schema";

/**
 * SQLite (bun:sqlite) の Drizzle 接続を生成する。
 *
 * `db` は ORM 操作用、`sqlite` は FTS5 セットアップなどの raw SQL 用。
 * builder からは両方を使う。
 *
 * @param dbPath SQLite ファイルパス（省略時は MINUTES_DB_PATH 環境変数、またはカレントディレクトリの minutes.db）
 */
export function createDb(dbPath?: string) {
  const path = dbPath ?? process.env.MINUTES_DB_PATH ?? "./minutes.db";
  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const db = drizzle(sqlite, { schema, casing: "snake_case" });
  return { db, sqlite };
}

export type Db = ReturnType<typeof createDb>["db"];

export {
  municipalities,
  meetings,
  statements,
  minute_files,
} from "./schema";
export type { UploadStatus } from "./schema";
