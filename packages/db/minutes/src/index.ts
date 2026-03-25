import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schema";

/**
 * SQLite (bun:sqlite) の Drizzle 接続を生成する。
 *
 * FTS5 セットアップなどの raw SQL は `db.$client` 経由で実行できる。
 *
 * @param dbPath SQLite ファイルパス（省略時は MINUTES_DB_PATH 環境変数、またはカレントディレクトリの minutes.db）
 */
export function createDb(dbPath?: string) {
  const path = dbPath ?? process.env.MINUTES_DB_PATH ?? "./minutes.db";
  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return drizzle(sqlite, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

export {
  municipalities,
  meetings,
  statements,
} from "./schema";
export type { SystemType } from "./schema/municipalities";
