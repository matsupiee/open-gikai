/**
 * ローカル開発用スクレイパー実行スクリプト。
 * Cloudflare Queue の代わりにインメモリキューを使ってジョブを同期的に処理する。
 *
 * インメモリキュー=DBや外部サービスを使わず、プロセスのRAMだけで管理するジョブキュー。
 *
 * 使い方:
 *   bun run run:local
 *   bun run run:local --limit 2   # 各自治体の会議数を2件に制限（動作確認用）
 *
 * 実行順:
 * 1. DB から status="pending" のジョブを取得
 * 2. 各ジョブをキューに投入し、ハンドラーを順次呼び出す
 * 3. 生成された meetings を statements に変換（OPENAI_API_KEY があれば embedding も生成）
 */
import { createDb } from "@open-gikai/db";
import type { ScraperQueueMessage } from "./types";
import { dispatchJob } from "../handlers/dispatch-job";
import { handleQueueMessage, handleMessageError } from "./handle-message";
import { fetchPendingJobs } from "./jobs";

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = resolve(fileURLToPath(import.meta.url), "../../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const db = createDb(process.env.DATABASE_URL!);

function parseMeetingLimit(): number | undefined {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return undefined;
  const value = Number(process.argv[idx + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    console.error("[local-runner] --limit には正の整数を指定してください");
    process.exit(1);
  }
  return value;
}

const meetingLimit = parseMeetingLimit();

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
  if (meetingLimit) {
    console.log(`[local-runner] 会議数上限: ${meetingLimit} 件/自治体`);
  }

  const pendingJobs = await fetchPendingJobs(db);

  if (pendingJobs.length === 0) {
    console.log("[local-runner] No pending jobs found.");
  } else {
    console.log(`[local-runner] Found ${pendingJobs.length} pending job(s)`);

    const queue = new LocalQueue();
    for (const job of pendingJobs) {
      await dispatchJob(db, queue, job, { meetingLimit });
    }
    await queue.processAll();
  }

  console.log("[local-runner] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[local-runner] Fatal error:", err);
  process.exit(1);
});
