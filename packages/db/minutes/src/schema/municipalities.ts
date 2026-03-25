import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const REGION_SLUGS = [
  "hokkaido",
  "tohoku",
  "kanto",
  "chubu",
  "kinki",
  "chugoku",
  "shikoku",
  "kyushu",
] as const;
export type RegionSlug = (typeof REGION_SLUGS)[number];

/**
 * 自治体マスタテーブル（SQLite 版）。
 * PostgreSQL 版の system_types FK は systemType テキストに簡略化。
 */
export const municipalities = sqliteTable(
  "municipalities",
  {
    /** 総務省 地方公共団体コード（6桁）— 主キー（NDJSON・meetings.municipalityCode と同一） */
    code: text().primaryKey(),
    createdAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
    /** 自治体名（例: 鹿児島市） */
    name: text().notNull(),
    /** 都道府県名（例: 鹿児島県） */
    prefecture: text().notNull(),
    /** 8地方分類（例: "hokkaido", "kanto"） */
    regionSlug: text({ enum: REGION_SLUGS }).notNull(),
    /** 会議録トップ URL */
    baseUrl: text(),
    /** スクレイピング対象フラグ */
    enabled: integer({ mode: "boolean" }).notNull().default(true),
    /** 人口（住民基本台帳ベース） */
    population: integer(),
    /** 人口データの基準年 */
    populationYear: integer(),
  },
  (table) => [index("municipalities_prefecture_idx").on(table.prefecture)],
);
