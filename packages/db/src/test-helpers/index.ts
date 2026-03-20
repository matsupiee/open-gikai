import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Sql } from "postgres";
import * as schema from "../schema";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres_test";

type TestDb = ReturnType<typeof drizzle<typeof schema>> & { $client: Sql };

function getTestDatabaseUrl() {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

/**
 * テスト用データベース `postgres_test` を作成する（存在しなければ）。
 * 管理用接続は `postgres` DB に対して行う。
 */
export async function createTestDatabase() {
  const testUrl = getTestDatabaseUrl();
  // テスト DB 名を URL からパース
  const dbName = new URL(testUrl).pathname.slice(1) || "postgres_test";

  // 管理用: postgres DB に接続
  const adminUrl = testUrl.replace(`/${dbName}`, "/postgres");
  const adminSql = postgres(adminUrl, { max: 1 });

  try {
    const result = await adminSql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;
    if (result.length === 0) {
      await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await adminSql.end();
  }
}

/**
 * テスト用 Drizzle 接続を返す。
 */
export function getTestDb(): TestDb {
  const client = postgres(getTestDatabaseUrl(), { prepare: false });
  return drizzle(client, { schema, casing: "snake_case" }) as TestDb;
}

/**
 * テスト DB にマイグレーションを実行する。
 */
export async function runMigrations(db: TestDb) {
  await migrate(db, { migrationsFolder });
}

/**
 * コネクションプールを終了する。
 */
export async function closeTestDb(db: TestDb) {
  await db.$client.end();
}

/**
 * トランザクション内で fn を実行し、必ずロールバックする。
 * テスト間の分離を保証する。
 *
 * fn には Db 互換の型を渡すため、サービス関数をキャストなしで呼べる。
 */
export async function withRollback<T>(
  db: TestDb,
  fn: (tx: TestDb) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx as unknown as TestDb);
      tx.rollback();
    });
  } catch {
    // tx.rollback() は TransactionRollbackError を throw する
    // Drizzle が内部でキャッチしてロールバックを実行するため、ここでは握りつぶす
    return result!;
  }
  return result!;
}
