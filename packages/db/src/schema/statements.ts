import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { meetings } from "./meetings";
import { statement_policy_tags } from "./policy-tags";
import { createId } from "@paralleldrive/cuid2";

/**
 * 全文検索用のカスタム型。
 * PostgreSQL の tsvector(text search = 全文検索) 型にマッピングする。
 * content カラムの内容から自動生成され、手動更新は不要。
 *
 * 余計な単語を削除して意味のある単語だけを検索用インデックス形式で保存する
 *
 * 例
 * "The cat is very cute" -> "cat":2  "cute":5
 */
const tsvector = () =>
  customType<{ data: unknown; driverData: unknown }>({
    dataType() {
      return "tsvector";
    },
  })("content_tsv");

/**
 * 会議の発言データを格納するテーブル。
 * ベクトル検索（意味的類似度）と全文検索の両方に対応している。
 */
export const statements = pgTable(
  "statements",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    // どの会議の発言か（meetings テーブルへの外部キー。会議削除時に発言も削除）
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    // 発言の種別（例: 質問、答弁、一般発言 など）
    kind: text().notNull(),
    speakerName: text(),
    speakerRole: text(),
    // 発言の本文
    content: text().notNull(),
    // 重複取り込み防止用のコンテンツハッシュ
    contentHash: text().notNull(),
    // 原文ドキュメント内での位置（文字オフセット）
    startOffset: integer(),
    endOffset: integer(),
    // 全文検索用インデックス（content から自動生成される仮想カラム）
    contentTsv: tsvector().generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(content, ''))`
    ),
  },
  (table) => [
    // 同じ会議内での発言重複を防ぐユニーク制約
    uniqueIndex().on(table.meetingId, table.contentHash),
    // 会議 ID での絞り込みを高速化
    index().on(table.meetingId),
    // 発言種別での絞り込みを高速化
    index().on(table.kind),
    // 発言者名での絞り込みを高速化
    index().on(table.speakerName),
  ]
);

/** statements テーブルのリレーション定義 */
export const statementsRelations = relations(statements, ({ one, many }) => ({
  // 発言は1つの会議に属する（多対1）
  meeting: one(meetings, {
    fields: [statements.meetingId],
    references: [meetings.id],
  }),
  // 発言には複数の政策タグが付く（1対多）
  policy_tags: many(statement_policy_tags),
}));
