import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * DATABASE_URL をパースする。
 * パスワードに @, %, ! などの特殊文字が含まれていても安全にパースできる。
 * 形式: postgresql://user:password@host:port/database
 */
function parseDatabaseUrl(url: string) {
  const withoutScheme = url.replace(/^postgres(ql)?:\/\//, "");
  const lastAtIndex = withoutScheme.lastIndexOf("@");
  const userInfo = withoutScheme.slice(0, lastAtIndex);
  const hostInfo = withoutScheme.slice(lastAtIndex + 1);

  const firstColonIndex = userInfo.indexOf(":");
  const username = userInfo.slice(0, firstColonIndex);
  const password = userInfo.slice(firstColonIndex + 1);

  const [hostPort, ...rest] = hostInfo.split("/");
  const databaseWithParams = rest.join("/") || "postgres";
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
 * 呼び出し側で DATABASE_URL を渡して使用する。
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

export { minute_files, uploadStatusEnum } from "./schema";
