import { pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { statements } from "./statements";

export const policy_tags = pgTable(
  "policy_tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  }
);

export const statement_policy_tags = pgTable(
  "statement_policy_tags",
  {
    statement_id: text("statement_id")
      .notNull()
      .references(() => statements.id, { onDelete: "cascade" }),
    tag_id: text("tag_id")
      .notNull()
      .references(() => policy_tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("statement_policy_tags_statement_id_tag_id_idx").on(
      table.statement_id,
      table.tag_id
    ),
    index("statement_policy_tags_tag_id_statement_id_idx").on(
      table.tag_id,
      table.statement_id
    ),
  ]
);

export const policy_tagsRelations = relations(policy_tags, ({ many }) => ({
  statements: many(statement_policy_tags),
}));

export const statement_policy_tagsRelations = relations(
  statement_policy_tags,
  ({ one }) => ({
    statement: one(statements, {
      fields: [statement_policy_tags.statement_id],
      references: [statements.id],
    }),
    tag: one(policy_tags, {
      fields: [statement_policy_tags.tag_id],
      references: [policy_tags.id],
    }),
  })
);
