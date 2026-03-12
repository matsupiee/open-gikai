import { eq, inArray } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import { createDb } from "@open-gikai/db";
import type { Env, ScraperQueueMessage } from "./utils/types";
import { handleStartJob } from "./handlers/start-job";
import { handleKagoshimaCouncil } from "./handlers/kagoshima";
import { handleNdlPage } from "./handlers/ndl";
import { handleLocalTarget } from "./handlers/local";
import {
  handleDiscussnetList,
  handleDiscussnetMeeting,
} from "./handlers/discussnet";
import { updateScraperJobStatus } from "./db/job-logger";

export default {
  /**
   * Cron トリガー: 1 分ごとに pending ジョブを検出して Queue に投入する。
   */
  async scheduled(
    _event: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    // pendingステータスのjobを10件取得する
    const pendingJobs = await db
      .select({ id: scraper_jobs.id })
      .from(scraper_jobs)
      .where(eq(scraper_jobs.status, "pending"))
      .limit(10);

    if (pendingJobs.length === 0) return;

    // 取得した10件をqueuedに変更してから投入する（次のcronで重複投入されないようにする）
    const jobIds = pendingJobs.map((j) => j.id);
    await db
      .update(scraper_jobs)
      .set({ status: "queued" })
      .where(inArray(scraper_jobs.id, jobIds));

    for (const job of pendingJobs) {
      // packages/infra/alchemyで作成されたCloudflare Queueが環境変数としてバインドされているので、それを呼び出す
      await env.SCRAPER_QUEUE.send({ type: "start-job", jobId: job.id });
    }
  },

  /**
   * Queue コンシューマー: 各メッセージをタイプに応じたハンドラーに振り分ける。
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
          case "discussnet-list":
            await handleDiscussnetList(db, env.SCRAPER_QUEUE, msg);
            break;
          case "discussnet-meeting":
            await handleDiscussnetMeeting(db, msg);
            break;
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
