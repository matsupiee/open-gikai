import { eq, inArray } from "drizzle-orm";
import { municipalities, scraper_jobs } from "@open-gikai/db/schema";
import { createDb } from "@open-gikai/db";
import type { Env, ScraperQueueMessage } from "./utils/types";
import { dispatchJob } from "./handlers/dispatch-job";
import {
  handleDiscussnetList,
  handleDiscussnetMeeting,
} from "./handlers/discussnet";
import {
  handleDiscussnetSspSchedule,
  handleDiscussnetSspMinute,
} from "./handlers/discussnet-ssp";
import { updateScraperJobStatus } from "./utils/job-logger";

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

    const pendingJobs = await db
      .select()
      .from(scraper_jobs)
      .innerJoin(
        municipalities,
        eq(scraper_jobs.municipalityId, municipalities.id)
      )
      .where(eq(scraper_jobs.status, "pending"))
      .limit(10);

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
   * Queue コンシューマー: discussnet-list / discussnet-meeting を処理する。
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
        switch (msg.type) {
          case "discussnet-list":
            await handleDiscussnetList(db, env.SCRAPER_QUEUE, msg);
            break;
          case "discussnet-meeting":
            await handleDiscussnetMeeting(db, msg);
            break;
          case "discussnet-ssp-schedule":
            await handleDiscussnetSspSchedule(db, env.SCRAPER_QUEUE, msg);
            break;
          case "discussnet-ssp-minute":
            await handleDiscussnetSspMinute(db, msg);
            break;
          default: {
            const _exhaustive: never = msg;
            console.warn(`[scraper-worker] unknown message type:`, _exhaustive);
          }
        }
        message.ack();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(
          `[scraper-worker] handler error for type=${msg.type}:`,
          errorMessage
        );

        // ジョブをエラー終了させる
        if ("jobId" in msg) {
          await updateScraperJobStatus(db, msg.jobId, "failed", {
            errorMessage,
          });
        }

        // retryOnThrow のデフォルト動作 (再キュー) を避けるため ack する
        // ackするとメッセージがキューから削除されて再実行されない
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<Env>;
