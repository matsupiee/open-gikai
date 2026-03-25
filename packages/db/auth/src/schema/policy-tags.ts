import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { statements } from "./statements";
import { createId } from "@paralleldrive/cuid2";

export const policy_tags = pgTable("policy_tags", {
  id: text()
    .$defaultFn(() => createId())
    .primaryKey(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  name: text().notNull().unique(),
});

export const statement_policy_tags = pgTable(
  "statement_policy_tags",
  {
    statementId: text()
      .notNull()
      .references(() => statements.id, { onDelete: "cascade" }),
    tagId: text()
      .notNull()
      .references(() => policy_tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex().on(table.statementId, table.tagId),
    index().on(table.tagId, table.statementId),
  ]
);

export const policy_tagsRelations = relations(policy_tags, ({ many }) => ({
  statements: many(statement_policy_tags),
}));

export const statement_policy_tagsRelations = relations(
  statement_policy_tags,
  ({ one }) => ({
    statement: one(statements, {
      fields: [statement_policy_tags.statementId],
      references: [statements.id],
    }),
    tag: one(policy_tags, {
      fields: [statement_policy_tags.tagId],
      references: [policy_tags.id],
    }),
  })
);
