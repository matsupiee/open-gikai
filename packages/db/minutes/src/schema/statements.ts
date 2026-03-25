import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const statements = sqliteTable(
  "statements",
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
    meetingId: text().notNull(),
    kind: text().notNull(),
    speakerName: text(),
    speakerRole: text(),
    content: text().notNull(),
    contentHash: text().notNull(),
    startOffset: integer(),
    endOffset: integer(),
  },
  (table) => [
    uniqueIndex("statements_meeting_content_hash_idx").on(
      table.meetingId,
      table.contentHash
    ),
    index("statements_meeting_id_idx").on(table.meetingId),
    index("statements_kind_idx").on(table.kind),
    index("statements_speaker_name_idx").on(table.speakerName),
  ]
);
