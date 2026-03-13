import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

/**
 * 議会録システム種別マスタ。
 * pgEnum の代わりにテーブルで管理することで、マイグレーションなしに値を追加できる。
 */
export const system_types = pgTable(
  "system_types",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    name: text().notNull().unique(),
    description: text().notNull(),
  },
  (table) => [uniqueIndex().on(table.name)]
);

/** 既知のシステム種別（アプリコードでの型付けに使用） */
export type SystemType =
  | "discussnet"
  | "discussnet_ssp"
  | "dbsearch"
  | "kensakusystem"
  | "sophia"
  | "voices"
  | "custom_html"
  | "pdf";

/** system_types テーブルの初期データ */
export const SYSTEM_TYPES_SEED: Array<{
  name: SystemType;
  description: string;
}> = [
  { name: "discussnet", description: "NTT-AT DiscussNet（ASP版・全国最多）" },
  {
    name: "discussnet_ssp",
    description: "NTT-AT DiscussNet SSP（SaaS版: ssp.kaigiroku.net）",
  },
  { name: "dbsearch", description: "大和速記情報センター（dbsr.jp）" },
  {
    name: "kensakusystem",
    description: "kensakusystem.jp（複数自治体共通検索システム）",
  },
  { name: "sophia", description: "神戸綜合速記" },
  { name: "voices", description: "フューチャーイン" },
  { name: "custom_html", description: "独自 CMS" },
  { name: "pdf", description: "PDF 直接公開" },
];
