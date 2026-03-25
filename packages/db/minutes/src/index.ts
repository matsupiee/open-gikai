import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schema";

/**
 * SQLite (bun:sqlite) の Drizzle 接続を生成する。
 *
 * FTS5 セットアップなどの raw SQL は `db.$client` 経由で実行できる。
 */
export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath, { create: true });

  // 書き込みを速く＆安全にするために、WAL（Write-Ahead Logging）モードにする
  // デフォルト: DBを書き換え → 失敗したら壊れる可能性
  // WAL: ① 変更をWALファイルに書く ② 後でまとめてDBに反映
  sqlite.run("PRAGMA journal_mode = WAL;");

  // 外部キー制約を有効にする
  sqlite.run("PRAGMA foreign_keys = ON;");

  return drizzle(sqlite, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

export { municipalities, meetings, statements } from "./schema";
export { ShardedMinutesDb } from "./shard";
export type { ShardFilter } from "./shard";
export { prefectureToRegion, prefectureToRegionSlug, REGION_TO_PREFECTURES } from "./utils/region";
