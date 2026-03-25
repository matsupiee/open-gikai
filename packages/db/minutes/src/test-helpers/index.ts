import { TransactionRollbackError } from "drizzle-orm";
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
 */
export async function createTestDatabase() {
  const testUrl = getTestDatabaseUrl();
  const dbName = new URL(testUrl).pathname.slice(1) || "postgres_test";

  const adminUrl = testUrl.replace(`/${dbName}`, "/postgres");
  const adminSql = postgres(adminUrl, { max: 1 });

  try {
    const result = await adminSql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;
    if (result.length === 0) {
      try {
        await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
      } catch (e: unknown) {
        if (e instanceof Error && "code" in e && e.code === "23505") {
          // 別プロセスが先に作成済み — 正常
        } else {
          throw e;
        }
      }
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
 * 並列実行時の競合を防ぐため、アドバイザリロックで直列化する。
 */
export async function runMigrations(db: TestDb) {
  const LOCK_ID = 836874; // 任意の固定値（db/auth とは異なる値）
  await db.$client`SELECT pg_advisory_lock(${LOCK_ID})`;
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.$client`SELECT pg_advisory_unlock(${LOCK_ID})`;
  }
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
  } catch (e) {
    if (e instanceof TransactionRollbackError) {
      return result!;
    }
    throw e;
  }
  return result!;
}
