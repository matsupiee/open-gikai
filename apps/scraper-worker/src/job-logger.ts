import { eq, sql } from "drizzle-orm";
import { scraper_job_logs, scraper_jobs } from "@open-gikai/db/schema";
import type { Db } from "./db";
import type { Logger } from "@open-gikai/scraper";

/**
 * ジョブ ID に紐付く Logger を生成する。
 * scraper_job_logs テーブルにログを書き込む。
 */
export function createJobLogger(db: Db, jobId: string): Logger {
  return async (level, message) => {
    await db.insert(scraper_job_logs).values({
      id: crypto.randomUUID(),
      job_id: jobId,
      level,
      message,
      created_at: new Date(),
    });
  };
}

/**
 * ジョブステータスを更新する。
 */
export async function updateJobStatus(
  db: Db,
  jobId: string,
  status: "running" | "completed" | "failed" | "cancelled",
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
      ...(status === "running" ? { started_at: new Date() } : {}),
      ...(status === "completed" || status === "failed"
        ? { completed_at: new Date() }
        : {}),
      ...(extra?.errorMessage !== undefined ? { error_message: extra.errorMessage } : {}),
      ...(extra?.totalInserted !== undefined ? { total_inserted: extra.totalInserted } : {}),
      ...(extra?.totalSkipped !== undefined ? { total_skipped: extra.totalSkipped } : {}),
      ...(extra?.totalItems !== undefined ? { total_items: extra.totalItems } : {}),
      ...(extra?.processedItems !== undefined ? { processed_items: extra.processedItems } : {}),
    })
    .where(eq(scraper_jobs.id, jobId));
}

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
      total_inserted: sql`${scraper_jobs.total_inserted} + ${inserted}`,
      total_skipped: sql`${scraper_jobs.total_skipped} + ${skipped}`,
      processed_items: sql`${scraper_jobs.processed_items} + 1`,
    })
    .where(eq(scraper_jobs.id, jobId));
}
