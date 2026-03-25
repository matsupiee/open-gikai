import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schema";

/**
 * SQLite (bun:sqlite) の Drizzle 接続を生成する。
 * @param dbPath SQLite ファイルパス（省略時は環境変数 MINUTES_DB_PATH またはデフォルトパス）
 */
export function createDb(dbPath?: string) {
  const path = dbPath ?? process.env.MINUTES_DB_PATH ?? "./minutes.db";
  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  return drizzle(sqlite, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

export { minute_files } from "./schema";
export type { UploadStatus } from "./schema";
