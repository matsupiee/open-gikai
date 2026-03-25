import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

import { municipalities } from "./municipalities";

export const meetings = sqliteTable(
  "meetings",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
    /** 自治体コード（municipalities.code） */
    municipalityCode: text()
      .notNull()
      .references(() => municipalities.code),
    title: text().notNull(),
    meetingType: text().notNull(),
    /** ISO 日付文字列（YYYY-MM-DD） */
    heldOn: text().notNull(),
    sourceUrl: text(),
    externalId: text(),
    status: text().notNull().default("pending"),
    scrapedAt: integer({ mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("meetings_municipality_external_id_idx").on(
      table.municipalityCode,
      table.externalId,
    ),
    index("meetings_held_on_idx").on(table.heldOn),
    index("meetings_meeting_type_held_on_idx").on(table.meetingType, table.heldOn),
    index("meetings_municipality_held_on_idx").on(table.municipalityCode, table.heldOn),
  ],
);
