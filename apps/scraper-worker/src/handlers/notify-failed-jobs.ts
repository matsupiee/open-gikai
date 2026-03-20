import { and, eq, gte } from "drizzle-orm";
import { scraper_jobs, municipalities } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { sendSlackWebhook } from "@open-gikai/notification";

/** 通知対象とする失敗ジョブの遡り期間（分） */
const LOOKBACK_MINUTES = 5;

/**
 * 直近の失敗ジョブを集約して Slack に通知する。
 */
export async function notifyFailedJobs(
  db: Db,
  slackWebhookUrl: string | undefined
): Promise<void> {
  if (!slackWebhookUrl) return;

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

  const failedJobs = await db
    .select({
      jobId: scraper_jobs.id,
      municipalityName: municipalities.name,
      errorMessage: scraper_jobs.errorMessage,
      updatedAt: scraper_jobs.updatedAt,
    })
    .from(scraper_jobs)
    .innerJoin(municipalities, eq(scraper_jobs.municipalityId, municipalities.id))
    .where(
      and(
        eq(scraper_jobs.status, "failed"),
        gte(scraper_jobs.updatedAt, since)
      )
    );

  if (failedJobs.length === 0) return;

  const jobLines = failedJobs
    .map(
      (j) =>
        `• ${j.municipalityName}: ${j.errorMessage ?? "不明なエラー"} (ID: ${j.jobId})`
    )
    .join("\n");

  await sendSlackWebhook(slackWebhookUrl, {
    text: `🚨 直近 ${LOOKBACK_MINUTES} 分間に ${failedJobs.length} 件のスクレイピングジョブが失敗しました\n\n${jobLines}`,
  });
}
