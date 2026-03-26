import { pgTable, text, date, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
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
    municipalityCode: text()
      .notNull()
      .references(() => municipalities.code),
    title: text().notNull(),
    meetingType: text().notNull(),
    heldOn: date().notNull(),
    sourceUrl: text(),
    externalId: text(),
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
}));
