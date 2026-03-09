import { pgTable, text, date, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { statements } from "./statements";

export const meetings = pgTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    meeting_type: text("meeting_type").notNull(),
    held_on: date("held_on").notNull(),
    source_url: text("source_url"),
    assembly_level: text("assembly_level").notNull(),
    prefecture: text("prefecture"),
    municipality: text("municipality"),
    external_id: text("external_id"),
    raw_text: text("raw_text").notNull(),
    status: text("status").notNull().default("pending"),
    scraped_at: timestamp("scraped_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("meetings_assembly_level_external_id_idx").on(
      table.assembly_level,
      table.external_id
    ),
    index("meetings_held_on_idx").on(table.held_on),
    index("meetings_meeting_type_held_on_idx").on(table.meeting_type, table.held_on),
    index("meetings_assembly_level_held_on_idx").on(table.assembly_level, table.held_on),
    index("meetings_prefecture_held_on_idx").on(table.prefecture, table.held_on),
    index("meetings_municipality_held_on_idx").on(table.municipality, table.held_on),
  ]
);

export const meetingsRelations = relations(meetings, ({ many }) => ({
  statements: many(statements),
}));
