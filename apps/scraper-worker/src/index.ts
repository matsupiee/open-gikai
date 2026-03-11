import { eq } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import { createDb } from "./db";
import { updateJobStatus } from "./job-logger";
import type { Env, ScraperQueueMessage } from "./types";
import { handleStartJob } from "./handlers/start-job";
import { handleKagoshimaCouncil } from "./handlers/kagoshima";
import { handleNdlPage } from "./handlers/ndl";
import { handleLocalTarget } from "./handlers/local";

export default {
  /**
   * Cron トリガー: 1 分ごとに pending ジョブを検出して Queue に投入する。
   */
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    const pendingJobs = await db
      .select({ id: scraper_jobs.id })
      .from(scraper_jobs)
      .where(eq(scraper_jobs.status, "pending"))
      .limit(10);

    for (const job of pendingJobs) {
      await env.SCRAPER_QUEUE.send({ type: "start-job", jobId: job.id });
    }
  },

  /**
   * Queue コンシューマー: 各メッセージをタイプに応じたハンドラーに振り分ける。
   */
  async queue(batch: MessageBatch<unknown>, env: Env, _ctx: ExecutionContext): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    for (const message of batch.messages) {
      const msg = message.body as ScraperQueueMessage;

      try {
        switch (msg.type) {
          case "start-job":
            await handleStartJob(db, env.SCRAPER_QUEUE, msg.jobId);
            break;
          case "kagoshima-council":
            await handleKagoshimaCouncil(db, env.SCRAPER_QUEUE, msg);
            break;
          case "ndl-page":
            await handleNdlPage(db, env.SCRAPER_QUEUE, msg);
            break;
          case "local-target":
            await handleLocalTarget(db, msg);
            break;
        }
        message.ack();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[scraper-worker] handler error for type=${msg.type}:`, errorMessage);

        // ジョブをエラー終了させる
        if ("jobId" in msg) {
          await updateJobStatus(db, msg.jobId, "failed", { errorMessage });
        }

        // retryOnThrow のデフォルト動作 (再キュー) を避けるため ack する
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<Env>;
