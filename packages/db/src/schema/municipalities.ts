import { pgTable, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { meetings } from "./meetings";
import { topics } from "./topics";

/**
 * 自治体マスタテーブル。
 * 約 1,700 自治体の議会データ収集先を管理する。
 */
export const municipalities = pgTable(
  "municipalities",
  {
    /**
     * 総務省 地方公共団体コード（6桁）
     * ある番号の自治体が廃止されても、その番号が別の自治体に使いまわされることはないので安全
     */
    code: text().primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    /** 自治体名（例: 鹿児島市） */
    name: text().notNull(),
    /** 都道府県名（例: 鹿児島県） */
    prefecture: text().notNull(),
    /** 会議録トップ URL（議事録一覧ページ） */
    baseUrl: text(),
    /** 人口（住民基本台帳ベース） */
    population: integer(),
    /** 人口データの基準年（例: 2024） */
    populationYear: integer(),
  },
  (table) => [uniqueIndex().on(table.code), index().on(table.prefecture)],
);

export const municipalitiesRelations = relations(municipalities, ({ many }) => ({
  meetings: many(meetings),
  topics: many(topics),
}));
