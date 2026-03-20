import { and, eq, gte } from "drizzle-orm";
import { scraper_jobs, municipalities } from "@open-gikai/db/schema";
import type { Db } from "@open-gikai/db";
import { sendSlackWebhook } from "@open-gikai/notification";

/**
 * 直近 5 分間に失敗したジョブを集約して Slack に通知する。
 * 5 分おきの cron から呼ばれる。
 */
export async function notifyFailedJobs(
  db: Db,
  slackWebhookUrl: string | undefined
): Promise<void> {
  if (!slackWebhookUrl) return;

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

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
        gte(scraper_jobs.updatedAt, fiveMinutesAgo)
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
    text: `🚨 直近 5 分間に ${failedJobs.length} 件のスクレイピングジョブが失敗しました\n\n${jobLines}`,
  });
}
