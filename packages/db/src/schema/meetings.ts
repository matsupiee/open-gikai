import {
  pgTable,
  text,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { statements } from "./statements";
import { municipalities } from "./municipalities";
import { createId } from "@paralleldrive/cuid2";

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
    scrapedAt: timestamp(),
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),
    title: text().notNull(),
    meetingType: text().notNull(),
    heldOn: date().notNull(),
    sourceUrl: text(),
    externalId: text(),
    rawText: text().notNull(),
    status: text().notNull().default("pending"),
  },
  (table) => [
    uniqueIndex().on(table.municipalityId, table.externalId),
    index().on(table.heldOn),
    index().on(table.meetingType, table.heldOn),
    index().on(table.municipalityId, table.heldOn),
  ]
);

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  municipality: one(municipalities, {
    fields: [meetings.municipalityId],
    references: [municipalities.id],
  }),
  statements: many(statements),
}));
