import { eq } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import { scrapeLocal } from "@open-gikai/scraper";
import type { Db } from "../db";
import { addJobStats, createJobLogger, updateJobStatus } from "../job-logger";
import type { ScraperQueueMessage } from "../types";
import { saveMeetings } from "./save-meetings";

type LocalTargetMsg = Extract<ScraperQueueMessage, { type: "local-target" }>;

export async function handleLocalTarget(db: Db, msg: LocalTargetMsg): Promise<void> {
  const { jobId, target, limit } = msg;
  const logger = createJobLogger(db, jobId);

  // キャンセル確認
  const rows = await db
    .select({ status: scraper_jobs.status, processed: scraper_jobs.processed_items, total: scraper_jobs.total_items })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);

  const job = rows[0];
  if (!job) return;
  if (job.status === "cancelled") {
    await logger("info", "ジョブがキャンセルされました");
    return;
  }

  await logger("info", `Local: ${target.prefecture} ${target.municipality} を処理中`);

  const records = await scrapeLocal({ targets: [target], limit }, logger);
  const { inserted, skipped } = await saveMeetings(db, records);

  await addJobStats(db, jobId, inserted, skipped);
  await logger("info", `Local: ${target.municipality} 完了 (inserted=${inserted}, skipped=${skipped})`);

  // 全ターゲット処理済みか確認
  const updated = await db
    .select({ processed: scraper_jobs.processed_items, total: scraper_jobs.total_items })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);

  const updatedJob = updated[0];
  if (updatedJob && updatedJob.total !== null && updatedJob.processed >= updatedJob.total) {
    await updateJobStatus(db, jobId, "completed");
    await logger("info", `Local scrape 完了 (全 ${updatedJob.total} ターゲット処理済み)`);
  }
}
