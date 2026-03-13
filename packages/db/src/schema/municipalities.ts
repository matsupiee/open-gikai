import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { scraper_jobs } from "./scrapers";
import { meetings } from "./meetings";

export const systemTypeEnum = pgEnum("system_type", [
  "discussnet", // NTT-AT / 会議録研究所（全国最多）・従来 ASP 版
  "discussnet_ssp", // NTT-AT DiscussNet SSP（SaaS 版: ssp.kaigiroku.net）
  "dbsearch", // 大和速記情報センター
  "sophia", // 神戸綜合速記
  "voices", // フューチャーイン
  "custom_html", // 独自 CMS
  "pdf", // PDF 直接公開
]);
export type SystemType = (typeof systemTypeEnum.enumValues)[number];

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
    /** 会議録システム種別 */
    systemType: systemTypeEnum().notNull(),
    /** 会議録トップ URL（議事録一覧ページ） */
    baseUrl: text(),
    /** スクレイピング対象フラグ（false = robots.txt / 利用規約違反で除外） */
    enabled: boolean().notNull().default(true),
  },
  (table) => [
    uniqueIndex().on(table.code),
    index().on(table.prefecture),
    index().on(table.systemType),
    index().on(table.enabled, table.systemType),
  ]
);

export const municipalitiesRelations = relations(
  municipalities,
  ({ many }) => ({
    scraperJobs: many(scraper_jobs),
    meetings: many(meetings),
  })
);
