import { pgTable, text, date, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { statements } from "./statements";
import { municipalities } from "./municipalities";
import { meetingTopics } from "./topics";
import { createId } from "@paralleldrive/cuid2";

/**
 * 1 会議における 1 つの議題のダイジェスト。
 * meetings.topicDigests に配列として格納される。
 * PoC 段階では topic 名は自由形（文字列）。後段で正規化した topics テーブルに寄せる想定。
 */
export type MeetingTopicDigest = {
  topic: string;
  relevance: "primary" | "secondary";
  digest: string;
  speakers: string[];
};

export const meetings = pgTable(
  "meetings",
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
    title: text().notNull(),
    meetingType: text().notNull(),
    heldOn: date().notNull(),
    sourceUrl: text(),
    externalId: text(),
    summary: text(),
    topicDigests: jsonb().$type<MeetingTopicDigest[]>(),
    summaryGeneratedAt: timestamp(),
    summaryModel: text(),
  },
  (table) => [
    uniqueIndex().on(table.municipalityCode, table.externalId),
    index().on(table.heldOn),
    index().on(table.meetingType, table.heldOn),
    index().on(table.municipalityCode, table.heldOn),
  ],
);

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [meetings.municipalityCode],
    references: [municipalities.code],
  }),
  statements: many(statements),
  meetingTopics: many(meetingTopics),
}));
