import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { meetings } from "./meetings";
import { municipalities } from "./municipalities";

export const topicRelevanceEnum = pgEnum("topic_relevance", [
  "primary",
  "secondary",
]);

/**
 * 自治体ごとに正規化された議題マスタ。
 * meetings.topic_digests の自由文字列をクラスタリングした結果を保持する。
 * 横断（自治体跨ぎ）は Phase 4 以降の扱い。
 */
export const topics = pgTable(
  "topics",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    municipalityCode: text()
      .notNull()
      .references(() => municipalities.code),
    /** この議題の代表名（例: 市バス路線再編） */
    canonicalName: text().notNull(),
    /** 同義・表記ゆれの別名（例: ["市営バス再編", "バス路線の再編成"]） */
    aliases: text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** 議題の説明（任意）。LLM がクラスタを定義するときに吐く短い説明 */
    description: text(),
  },
  (table) => [
    uniqueIndex().on(table.municipalityCode, table.canonicalName),
    index().on(table.municipalityCode),
  ],
);

export const topicsRelations = relations(topics, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [topics.municipalityCode],
    references: [municipalities.code],
  }),
  meetingTopics: many(meetingTopics),
}));

/**
 * 会議と議題の多対多リンク。1 会議内の 1 議題ダイジェストを 1 行として持つ。
 * meetings.topic_digests の配列要素がこのテーブルの行に対応する。
 */
export const meetingTopics = pgTable(
  "meeting_topics",
  {
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    topicId: text()
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    relevance: topicRelevanceEnum().notNull(),
    /** この会議でのこの議題のダイジェスト文 */
    digest: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.meetingId, table.topicId] }),
    index().on(table.topicId),
  ],
);

export const meetingTopicsRelations = relations(meetingTopics, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingTopics.meetingId],
    references: [meetings.id],
  }),
  topic: one(topics, {
    fields: [meetingTopics.topicId],
    references: [topics.id],
  }),
}));
