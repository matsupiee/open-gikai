import { eq } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { scrapeLocal } from "../scrapers/local";
import {
  addJobStats,
  createScraperJobLog,
  updateScraperJobStatus,
} from "../db/job-logger";
import type { ScraperQueueMessage } from "../utils/types";
import { saveMeetings } from "../db/save-meetings";

type LocalTargetMsg = Extract<ScraperQueueMessage, { type: "local-target" }>;

export async function handleLocalTarget(
  db: Db,
  msg: LocalTargetMsg
): Promise<void> {
  const { jobId, target, limit } = msg;

  // キャンセル確認
  const rows = await db
    .select({
      status: scraper_jobs.status,
      processed: scraper_jobs.processedItems,
      total: scraper_jobs.totalItems,
    })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);

  const job = rows[0];
  if (!job) return;
  if (job.status === "cancelled") {
    await createScraperJobLog(db, {
      jobId,
      level: "info",
      message: "ジョブがキャンセルされました",
    });
    return;
  }

  await createScraperJobLog(db, {
    jobId,
    level: "info",
    message: `Local: ${target.prefecture} ${target.municipality} を処理中`,
  });

  const records = await scrapeLocal({ targets: [target], limit }, db, jobId);
  const { inserted, skipped } = await saveMeetings(db, records);

  await addJobStats(db, jobId, inserted, skipped);
  await createScraperJobLog(db, {
    jobId,
    level: "info",
    message: `Local: ${target.municipality} 完了 (inserted=${inserted}, skipped=${skipped})`,
  });

  // 全ターゲット処理済みか確認
  const updated = await db
    .select({
      processed: scraper_jobs.processedItems,
      total: scraper_jobs.totalItems,
    })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);

  const updatedJob = updated[0];
  if (
    updatedJob &&
    updatedJob.total !== null &&
    updatedJob.processed >= updatedJob.total
  ) {
    await updateScraperJobStatus(db, jobId, "completed");
    await createScraperJobLog(db, {
      jobId,
      level: "info",
      message: `Local scrape 完了 (全 ${updatedJob.total} ターゲット処理済み)`,
    });
  }
}
