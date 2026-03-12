import {
  pgTable,
  text,
  date,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { statements } from "./statements";
import { createId } from "@paralleldrive/cuid2";

export const assemblyLevelEnum = pgEnum("assembly_level", [
  "national", // 国会
  "prefectural", // 都道府県議会
  "municipal", // 市町村議会
]);
export type AssemblyLevel = (typeof assemblyLevelEnum.enumValues)[number];

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
    title: text().notNull(),
    meetingType: text().notNull(),
    heldOn: date().notNull(),
    sourceUrl: text(),
    assemblyLevel: assemblyLevelEnum().notNull(),
    prefecture: text(),
    municipality: text(),
    externalId: text(),
    rawText: text().notNull(),
    status: text().notNull().default("pending"),
    scrapedAt: timestamp(),
  },
  (table) => [
    uniqueIndex().on(table.assemblyLevel, table.externalId),
    index().on(table.heldOn),
    index().on(table.meetingType, table.heldOn),
    index().on(table.assemblyLevel, table.heldOn),
    index().on(table.prefecture, table.heldOn),
    index().on(table.municipality, table.heldOn),
  ]
);

export const meetingsRelations = relations(meetings, ({ many }) => ({
  statements: many(statements),
}));
