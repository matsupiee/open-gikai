import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * DATABASE_URL をパースする。
 * パスワードに @, %, ! などの特殊文字が含まれていても安全にパースできる。
 * 形式: postgresql://user:password@host:port/database
 */
function parseDatabaseUrl(url: string) {
  // "postgresql://" or "postgres://" を除去
  const withoutScheme = url.replace(/^postgres(ql)?:\/\//, "");
  // 最後の "@" でユーザー情報とホスト情報を分割（パスワードに @ が含まれるため）
  const lastAtIndex = withoutScheme.lastIndexOf("@");
  const userInfo = withoutScheme.slice(0, lastAtIndex);
  const hostInfo = withoutScheme.slice(lastAtIndex + 1);

  // ユーザー名とパスワードを最初の ":" で分割
  const firstColonIndex = userInfo.indexOf(":");
  const username = userInfo.slice(0, firstColonIndex);
  const password = userInfo.slice(firstColonIndex + 1);

  // ホスト:ポート/データベース?params をパース
  const [hostPort, ...rest] = hostInfo.split("/");
  const databaseWithParams = rest.join("/") || "postgres";
  // クエリパラメータを除去（?sslmode=disable など）
  const database = databaseWithParams.split("?")[0]!;
  const [host, portStr] = hostPort!.split(":");

  return {
    host: host!,
    port: Number(portStr) || 5432,
    database,
    username,
    password,
  };
}

/**
 * Drizzle 接続を生成する。
 * 呼び出し側（web, scraper-worker 等）で DATABASE_URL を渡して使用する。
 * postgres.js + prepare: false で Cloudflare Hyperdrive と互換性を持たせる。
 */
export function createDb(databaseUrl: string) {
  const { host, port, database, username, password } =
    parseDatabaseUrl(databaseUrl);
  const client = postgres({
    host,
    port,
    database,
    username,
    password,
    prepare: false,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

// Re-export schema for convenience
export { meetings, statements, municipalities, system_types } from "./schema";
