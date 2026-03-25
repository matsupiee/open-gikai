import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../schema";
import { setupFts } from "../fts";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * テスト用インメモリ SQLite 接続を返す。
 * マイグレーションと FTS5 セットアップを自動で実行する。
 */
export function getTestDb(): { db: TestDb; sqlite: Database } {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const db = drizzle(sqlite, { schema, casing: "snake_case" });
  migrate(db, { migrationsFolder });
  setupFts(sqlite);
  return { db, sqlite };
}
