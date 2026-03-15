import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { scraper_jobs } from "./scrapers";
import { meetings } from "./meetings";
import { system_types } from "./system-types";

export type { SystemType } from "./system-types";

/**
 * 自治体マスタテーブル。
 * 約 1,700 自治体の議会データ収集先を管理する。
 */
export const municipalities = pgTable(
  "municipalities",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    /** 総務省 地方公共団体コード（6桁） */
    code: text().unique().notNull(),
    /** 自治体名（例: 鹿児島市） */
    name: text().notNull(),
    /** 都道府県名（例: 鹿児島県） */
    prefecture: text().notNull(),
    /** 会議録システム種別（system_types.id を参照） */
    systemTypeId: text().references(() => system_types.id),
    /** 会議録トップ URL（議事録一覧ページ） */
    baseUrl: text(),
    /** スクレイピング対象フラグ（false = robots.txt / 利用規約違反で除外） */
    enabled: boolean().notNull().default(true),
    /** 人口（住民基本台帳ベース） */
    population: integer(),
    /** 人口データの基準年（例: 2024） */
    populationYear: integer(),
  },
  (table) => [
    uniqueIndex().on(table.code),
    index().on(table.prefecture),
    index().on(table.systemTypeId),
    index().on(table.enabled, table.systemTypeId),
  ]
);

export const municipalitiesRelations = relations(
  municipalities,
  ({ many, one }) => ({
    scraperJobs: many(scraper_jobs),
    meetings: many(meetings),
    systemTypeRecord: one(system_types, {
      fields: [municipalities.systemTypeId],
      references: [system_types.id],
    }),
  })
);
