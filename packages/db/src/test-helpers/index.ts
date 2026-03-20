import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../schema";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres_test";

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
export function getTestDb() {
  const client = postgres(getTestDatabaseUrl(), { prepare: false });
  return drizzle(client, { schema, casing: "snake_case" });
}

/**
 * テスト DB にマイグレーションを実行する。
 */
export async function runMigrations(db: ReturnType<typeof getTestDb>) {
  await migrate(db, { migrationsFolder });
}

/**
 * コネクションプールを終了する。
 * drizzle の内部 client ($client) を使ってクローズする。
 */
export async function closeTestDb(db: ReturnType<typeof getTestDb>) {
  // postgres.js の end() を呼ぶ
  await (db as unknown as { $client: postgres.Sql }).$client.end();
}

/**
 * トランザクション内で fn を実行し、必ずロールバックする。
 * テスト間の分離を保証する。
 */
export async function withRollback<T>(
  db: ReturnType<typeof getTestDb>,
  fn: (tx: ReturnType<typeof getTestDb>) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx as unknown as ReturnType<typeof getTestDb>);
      // 強制ロールバック
      throw new RollbackError();
    });
  } catch (e) {
    if (e instanceof RollbackError) {
      return result!;
    }
    throw e;
  }
  // unreachable
  return result!;
}

class RollbackError extends Error {
  constructor() {
    super("__ROLLBACK__");
    this.name = "RollbackError";
  }
}
