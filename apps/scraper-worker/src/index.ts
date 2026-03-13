import { inArray } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import { createDb } from "@open-gikai/db";
import type { Env, ScraperQueueMessage } from "./utils/types";
import { dispatchJob } from "./handlers/dispatch-job";
import { handleQueueMessage, handleMessageError } from "./utils/handle-message";
import { fetchPendingJobs } from "./utils/jobs";

export default {
  /**
   * Cron トリガー: 1 分ごとに pending ジョブを検出し、各ジョブの最初のキューメッセージを直接投入する。
   */
  async scheduled(
    _event: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    const pendingJobs = await fetchPendingJobs(db);

    if (pendingJobs.length === 0) return;

    const jobIds = pendingJobs.map((j) => j.scraper_jobs.id);
    await db
      .update(scraper_jobs)
      .set({ status: "queued" })
      .where(inArray(scraper_jobs.id, jobIds));

    for (const job of pendingJobs) {
      await dispatchJob(db, env.SCRAPER_QUEUE, job);
    }
  },

  /**
   * Queue コンシューマー: キューメッセージを処理する。
   */
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    for (const message of batch.messages) {
      const msg = message.body as ScraperQueueMessage;

      try {
        await handleQueueMessage(db, env.SCRAPER_QUEUE, msg);
        message.ack();
      } catch (err) {
        await handleMessageError(db, msg, err);
        // retryOnThrow のデフォルト動作 (再キュー) を避けるため ack する
        // ackするとメッセージがキューから削除されて再実行されない
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<Env>;
