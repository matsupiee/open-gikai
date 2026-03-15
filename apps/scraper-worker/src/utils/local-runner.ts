/**
 * ローカル開発用スクレイパー実行スクリプト。
 * Cloudflare Queue の代わりにインメモリキューを使ってジョブを同期的に処理する。
 *
 * インメモリキュー=DBや外部サービスを使わず、プロセスのRAMだけで管理するジョブキュー。
 *
 * 使い方:
 *   bun run run:local
 *
 * 実行順:
 * 1. DB から status="pending" のジョブを取得
 * 2. 各ジョブをキューに投入し、ハンドラーを順次呼び出す
 * 3. 生成された meetings を statements に変換（OPENAI_API_KEY があれば embedding も生成）
 */
import { eq } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import { createDb } from "@open-gikai/db";
import type { ScraperQueueMessage } from "./types";
import { dispatchJob } from "../handlers/dispatch-job";
import { handleQueueMessage, handleMessageError } from "./handle-message";
import { fetchPendingJobs } from "./jobs";
import { processPendingMeetings } from "./process-meetings";
import { updateScraperJobStatus } from "./job-logger";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[local-runner] DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

/** Cloudflare Queue<ScraperQueueMessage> の最小互換モック */
class LocalQueue {
  private readonly messages: ScraperQueueMessage[] = [];

  async send(msg: ScraperQueueMessage): Promise<void> {
    this.messages.push(msg);
  }

  async sendBatch(
    msgs: Iterable<{ body: ScraperQueueMessage }>
  ): Promise<void> {
    for (const m of msgs) {
      this.messages.push(m.body);
    }
  }

  async processAll(): Promise<void> {
    while (this.messages.length > 0) {
      const msg = this.messages.shift()!;
      console.log(`[queue] Processing: type=${msg.type}`);

      // LocalQueue は Queue<ScraperQueueMessage> を構造的に満たすためキャスト
      const q = this as unknown as Queue<ScraperQueueMessage>;

      try {
        await handleQueueMessage(db, q, msg, process.env.OPENAI_API_KEY);
      } catch (err) {
        await handleMessageError(db, msg, err);
      }
    }
  }
}

async function main() {
  console.log("[local-runner] Starting...");

  const pendingJobs = await fetchPendingJobs(db);

  if (pendingJobs.length === 0) {
    console.log("[local-runner] No pending jobs found.");
  } else {
    console.log(`[local-runner] Found ${pendingJobs.length} pending job(s)`);

    const queue = new LocalQueue();
    for (const job of pendingJobs) {
      await dispatchJob(db, queue, job);
    }
    await queue.processAll();

    // running 状態のジョブを completed に更新（Cloudflare Queue と異なりローカルは同期処理のため）
    for (const job of pendingJobs) {
      const [current] = await db
        .select({ status: scraper_jobs.status })
        .from(scraper_jobs)
        .where(eq(scraper_jobs.id, job.scraper_jobs.id))
        .limit(1);
      if (current?.status === "running") {
        await updateScraperJobStatus(db, job.scraper_jobs.id, "completed");
      }
    }
  }

  console.log("[local-runner] Processing pending meetings → statements...");
  await processPendingMeetings(db, process.env.OPENAI_API_KEY);

  console.log("[local-runner] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[local-runner] Fatal error:", err);
  process.exit(1);
});
