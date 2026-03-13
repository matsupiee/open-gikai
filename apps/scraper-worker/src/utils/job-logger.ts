import type { Db } from "@open-gikai/db";
import {
  scraper_job_logs,
  scraper_jobs,
  type LogLevel,
  type ScraperJobStatus,
} from "@open-gikai/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * ジョブ ID に紐付く Log を生成する。
 * scraper_job_logs テーブルにレコードを作成する
 */
export async function createScraperJobLog(
  db: Db,
  input: {
    jobId: string;
    level: LogLevel;
    message: string;
  }
) {
  await db.insert(scraper_job_logs).values({
    ...input,
  });
}

/**
 * ジョブステータスを更新する。
 */
export async function updateScraperJobStatus(
  db: Db,
  jobId: string,
  status: ScraperJobStatus,
  extra?: {
    errorMessage?: string;
    totalInserted?: number;
    totalSkipped?: number;
    totalItems?: number;
    processedItems?: number;
  }
): Promise<void> {
  await db
    .update(scraper_jobs)
    .set({
      status,
      startedAt: status === "running" ? new Date() : undefined,
      completedAt:
        status === "completed" || status === "failed" ? new Date() : undefined,
      ...extra,
    })
    .where(eq(scraper_jobs.id, jobId));
}

/**
 * ジョブ ID に紐付く Logger を生成する。
 * ハンドラーから createScraperJobLog を呼び出すラッパー。
 */
export function createJobLogger(db: Db, jobId: string) {
  return (level: LogLevel, message: string) =>
    createScraperJobLog(db, { jobId, level, message });
}

/** updateScraperJobStatus のエイリアス（start-job で使用） */
export const updateJobStatus = updateScraperJobStatus;

/**
 * ジョブの inserted/skipped カウントを加算更新する。
 */
export async function addJobStats(
  db: Db,
  jobId: string,
  inserted: number,
  skipped: number
): Promise<void> {
  await db
    .update(scraper_jobs)
    .set({
      totalInserted: sql`${scraper_jobs.totalInserted} + ${inserted}`,
      totalSkipped: sql`${scraper_jobs.totalSkipped} + ${skipped}`,
      processedItems: sql`${scraper_jobs.processedItems} + 1`,
    })
    .where(eq(scraper_jobs.id, jobId));
}
