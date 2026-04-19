import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

/**
 * 未ログインユーザーが meetings.ask を叩いた履歴を IP 単位で保持する。
 * 24 時間 rolling window で件数を数え、上限を超えたら拒否する用途。
 */
export const guest_ask_usage = pgTable(
  "guest_ask_usage",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    ip: text().notNull(),
  },
  (table) => [index().on(table.ip, table.createdAt)],
);
