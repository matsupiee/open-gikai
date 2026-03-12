import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { municipalities } from "./municipalities";

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
 * 1 ジョブ = 1 自治体のスクレイピング。
 */
export const scraper_jobs = pgTable(
  "scraper_jobs",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    /** 対象自治体 */
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),
    /** ジョブの状態 */
    status: scraperJobStatusEnum().notNull().default("pending"),
    /** スクレイピング対象になる年 */
    year: integer().notNull(),
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
    /** 処理開始日時 */
    startedAt: timestamp(),
    /** 処理完了日時 */
    completedAt: timestamp(),
  },
  (table) => [
    index().on(table.status),
    index().on(table.createdAt),
    index().on(table.municipalityId),
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
    level: logLevelEnum().notNull(),
    message: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [index().on(table.jobId), index().on(table.createdAt)]
);

export const scraperJobsRelations = relations(
  scraper_jobs,
  ({ many, one }) => ({
    logs: many(scraper_job_logs),
    municipality: one(municipalities, {
      fields: [scraper_jobs.municipalityId],
      references: [municipalities.id],
    }),
  })
);

export const scraperJobLogsRelations = relations(
  scraper_job_logs,
  ({ one }) => ({
    job: one(scraper_jobs, {
      fields: [scraper_job_logs.jobId],
      references: [scraper_jobs.id],
    }),
  })
);
