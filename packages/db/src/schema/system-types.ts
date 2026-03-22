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
export type SystemType = "discussnet_ssp" | "dbsearch" | "kensakusystem" | "gijiroku_com";

/** system_types テーブルの初期データ */
export const SYSTEM_TYPES_SEED: Array<{
  name: SystemType;
  description: string;
}> = [
  {
    name: "discussnet_ssp",
    description: "NTT-AT DiscussNet SSP（SaaS版: ssp.kaigiroku.net）",
  },
  { name: "dbsearch", description: "大和速記情報センター（dbsr.jp）" },
  {
    name: "kensakusystem",
    description: "kensakusystem.jp（複数自治体共通検索システム）",
  },
  {
    name: "gijiroku_com",
    description: "gijiroku.com（voiweb.exe ベースの議事録検索システム）",
  },
];
