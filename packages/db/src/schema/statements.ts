import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { meetings } from "./meetings";
import { createId } from "@paralleldrive/cuid2";

/** 会議の発言データを格納するテーブル。 */
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
  ],
);

/** statements テーブルのリレーション定義 */
export const statementsRelations = relations(statements, ({ one }) => ({
  // 発言は1つの会議に属する（多対1）
  meeting: one(meetings, {
    fields: [statements.meetingId],
    references: [meetings.id],
  }),
}));
