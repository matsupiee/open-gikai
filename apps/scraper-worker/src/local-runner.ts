/**
 * ローカル開発用スクレイパー実行スクリプト。
 * Cloudflare Queue の代わりにインメモリキューを使ってジョブを同期的に処理する。
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
import { createDb } from "./db";
import { updateJobStatus } from "./job-logger";
import type { ScraperQueueMessage } from "./types";
import { handleStartJob } from "./handlers/start-job";
import { handleKagoshimaCouncil } from "./handlers/kagoshima";
import { handleNdlPage } from "./handlers/ndl";
import { handleLocalTarget } from "./handlers/local";
import { processPendingMeetings } from "./handlers/process-meetings";

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

      try {
        // LocalQueue は Queue<ScraperQueueMessage> を構造的に満たすためキャスト
        const q = this as unknown as Queue<ScraperQueueMessage>;

        switch (msg.type) {
          case "start-job":
            await handleStartJob(db, q, msg.jobId);
            break;
          case "kagoshima-council":
            await handleKagoshimaCouncil(db, q, msg);
            break;
          case "ndl-page":
            await handleNdlPage(db, q, msg);
            break;
          case "local-target":
            await handleLocalTarget(db, msg);
            break;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(
          `[local-runner] Handler error for type=${msg.type}:`,
          errorMessage
        );
        if ("jobId" in msg) {
          await updateJobStatus(db, msg.jobId, "failed", { errorMessage });
        }
      }
    }
  }
}

async function main() {
  console.log("[local-runner] Starting...");

  const pendingJobs = await db
    .select({ id: scraper_jobs.id })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.status, "pending"))
    .limit(10);

  if (pendingJobs.length === 0) {
    console.log("[local-runner] No pending jobs found.");
  } else {
    console.log(`[local-runner] Found ${pendingJobs.length} pending job(s)`);

    const queue = new LocalQueue();
    for (const job of pendingJobs) {
      await queue.send({ type: "start-job", jobId: job.id });
    }

    await queue.processAll();
    console.log("[local-runner] Scraping complete.");
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
