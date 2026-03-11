import { pgTable, text, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * スクレイパージョブ管理テーブル。
 * GUI からトリガーされたスクレイピングジョブの状態を追跡する。
 */
export const scraper_jobs = pgTable(
  "scraper_jobs",
  {
    id: text("id").primaryKey(),
    /** スクレイパーの種類 */
    source: text("source").notNull(), // "ndl" | "local" | "kagoshima-api"
    /** ジョブの状態 */
    status: text("status").notNull().default("pending"), // "pending" | "running" | "completed" | "failed" | "cancelled"
    /** スクレイパー設定 (例: { from, until, prefecture, municipality, year }) */
    config: jsonb("config").notNull(),
    /** 処理済みアイテム数 */
    processed_items: integer("processed_items").notNull().default(0),
    /** 総アイテム数 (判明次第更新) */
    total_items: integer("total_items"),
    /** DB に挿入した件数 */
    total_inserted: integer("total_inserted").notNull().default(0),
    /** 重複でスキップした件数 */
    total_skipped: integer("total_skipped").notNull().default(0),
    /** エラーメッセージ (失敗時のみ) */
    error_message: text("error_message"),
    /** ジョブ作成日時 */
    created_at: timestamp("created_at").defaultNow().notNull(),
    /** 処理開始日時 */
    started_at: timestamp("started_at"),
    /** 処理完了日時 */
    completed_at: timestamp("completed_at"),
  },
  (table) => [
    index("scraper_jobs_status_idx").on(table.status),
    index("scraper_jobs_created_at_idx").on(table.created_at),
  ]
);

/**
 * スクレイパージョブのログテーブル。
 * 実行中のログをリアルタイムで記録し、GUI で表示する。
 */
export const scraper_job_logs = pgTable(
  "scraper_job_logs",
  {
    id: text("id").primaryKey(),
    job_id: text("job_id")
      .notNull()
      .references(() => scraper_jobs.id, { onDelete: "cascade" }),
    /** ログレベル */
    level: text("level").notNull(), // "info" | "warn" | "error"
    message: text("message").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("scraper_job_logs_job_id_idx").on(table.job_id),
    index("scraper_job_logs_created_at_idx").on(table.created_at),
  ]
);

export const scraperJobsRelations = relations(scraper_jobs, ({ many }) => ({
  logs: many(scraper_job_logs),
}));

export const scraperJobLogsRelations = relations(scraper_job_logs, ({ one }) => ({
  job: one(scraper_jobs, {
    fields: [scraper_job_logs.job_id],
    references: [scraper_jobs.id],
  }),
}));
