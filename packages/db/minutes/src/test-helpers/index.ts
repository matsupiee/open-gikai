import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../schema";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * テスト用インメモリ SQLite 接続を返す。
 * テストごとに独立した DB を使う。
 */
export function getTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA journal_mode = WAL;");
  return drizzle(sqlite, { schema, casing: "snake_case" });
}

/**
 * テスト DB にマイグレーションを実行する。
 */
export function runMigrations(db: TestDb) {
  migrate(db, { migrationsFolder });
}
