import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

/** 議会録システム種別（既知の値） */
export type SystemType = "discussnet_ssp" | "dbsearch" | "kensakusystem" | "gijiroku_com";

/**
 * 自治体マスタテーブル（SQLite 版）。
 * PostgreSQL 版の system_types FK は systemType テキストに簡略化。
 */
export const municipalities = sqliteTable(
  "municipalities",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
    /** 総務省 地方公共団体コード（6桁） */
    code: text().notNull(),
    /** 自治体名（例: 鹿児島市） */
    name: text().notNull(),
    /** 都道府県名（例: 鹿児島県） */
    prefecture: text().notNull(),
    /** 会議録システム種別（例: discussnet_ssp, dbsearch） */
    systemType: text(),
    /** 会議録トップ URL */
    baseUrl: text(),
    /** スクレイピング対象フラグ */
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    /** 人口（住民基本台帳ベース） */
    population: integer(),
    /** 人口データの基準年 */
    populationYear: integer(),
  },
  (table) => [
    uniqueIndex("municipalities_code_idx").on(table.code),
    index("municipalities_prefecture_idx").on(table.prefecture),
    index("municipalities_system_type_idx").on(table.systemType),
    index("municipalities_enabled_system_type_idx").on(
      table.enabled,
      table.systemType
    ),
  ]
);
