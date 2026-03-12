import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const systemTypeEnum = pgEnum("system_type", [
  "discussnet", // NTT-AT / 会議録研究所（全国最多）
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
    /** 総務省 地方公共団体コード（6桁） */
    code: text().unique().notNull(),
    /** 自治体名（例: 鹿児島市） */
    name: text().notNull(),
    /** 都道府県名（例: 鹿児島県） */
    prefecture: text().notNull(),
    /** 会議録システム種別 */
    systemType: systemTypeEnum("system_type").notNull(),
    /** 会議録トップ URL（議事録一覧ページ） */
    baseUrl: text(),
    /** スクレイピング対象フラグ（false = robots.txt / 利用規約違反で除外） */
    enabled: boolean().notNull().default(true),
    /** 最終スクレイピング日時 */
    lastScrapedAt: timestamp(),
    createdAt: timestamp().defaultNow().notNull(),
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
