import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "../schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * テスト用インメモリ SQLite 接続を返す。
 * マイグレーションを自動で実行する。
 */
export async function getTestDb(): Promise<TestDb> {
  const client = createClient({ url: "file::memory:" });
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });

  return db;
}
