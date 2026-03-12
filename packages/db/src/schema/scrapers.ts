import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const scraperJobStatusEnum = pgEnum("scraper_job_status", [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type ScraperJobStatus = (typeof scraperJobStatusEnum.enumValues)[number];

/**
 * スクレイパージョブ管理テーブル。
 * GUI からトリガーされたスクレイピングジョブの状態を追跡する。
 */
export const scraper_jobs = pgTable(
  "scraper_jobs",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    /** スクレイパーの種類 */
    source: text().notNull(), // "ndl" | "local" | "kagoshima-api"
    /** ジョブの状態 */
    status: scraperJobStatusEnum("status").notNull().default("pending"),
    /** スクレイパー設定 (例: { from, until, prefecture, municipality, year }) */
    config: jsonb().notNull(),
    /** 処理済みアイテム数 */
    processedItems: integer().notNull().default(0),
    /** 総アイテム数 (判明次第更新) */
    totalItems: integer(),
    /** DB に挿入した件数 */
    totalInserted: integer().notNull().default(0),
    /** 重複でスキップした件数 */
    totalSkipped: integer().notNull().default(0),
    /** エラーメッセージ (失敗時のみ) */
    errorMessage: text(),
    /** ジョブ作成日時 */
    createdAt: timestamp().defaultNow().notNull(),
    /** 処理開始日時 */
    startedAt: timestamp(),
    /** 処理完了日時 */
    completedAt: timestamp(),
  },
  (table) => [
    index("scraper_jobs_status_idx").on(table.status),
    index("scraper_jobs_created_at_idx").on(table.createdAt),
  ]
);

export const logLevelEnum = pgEnum("log_level", ["info", "warn", "error"]);
export type LogLevel = (typeof logLevelEnum.enumValues)[number];

/**
 * スクレイパージョブのログテーブル。
 * 実行中のログをリアルタイムで記録し、GUI で表示する。
 */
export const scraper_job_logs = pgTable(
  "scraper_job_logs",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    jobId: text()
      .notNull()
      .references(() => scraper_jobs.id, { onDelete: "cascade" }),
    /** ログレベル */
    level: logLevelEnum("level").notNull(),
    message: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    index("scraper_job_logs_job_id_idx").on(table.jobId),
    index("scraper_job_logs_created_at_idx").on(table.createdAt),
  ]
);

export const scraperJobsRelations = relations(scraper_jobs, ({ many }) => ({
  logs: many(scraper_job_logs),
}));

export const scraperJobLogsRelations = relations(
  scraper_job_logs,
  ({ one }) => ({
    job: one(scraper_jobs, {
      fields: [scraper_job_logs.jobId],
      references: [scraper_jobs.id],
    }),
  })
);
