import type { Db } from "@open-gikai/db";
import type { ScraperQueueMessage } from "./types";
import { updateScraperJobStatus } from "./job-logger";
import { handleDiscussnetSspSchedule } from "../system-types/discussnet-ssp/schedule/handler";
import { handleDiscussnetSspMinute } from "../system-types/discussnet-ssp/minute/handler";
import { handleGenericList } from "../handlers/generic-list";
import { handleGenericDetail } from "../handlers/generic-detail";

type DiscussnetSspMessage = Extract<
  ScraperQueueMessage,
  { type: `discussnet-ssp:${string}` }
>;

/**
 * キューメッセージを処理する共通ハンドラー。
 * index.ts (Cloudflare Worker) と local-runner.ts の両方から使用される。
 */
export async function handleQueueMessage(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: ScraperQueueMessage,
  openaiApiKey?: string
): Promise<void> {
  const [system] = msg.type.split(":") as [string, string];

  switch (system) {
    case "discussnet-ssp":
      await handleDiscussnetSsp(db, queue, msg as DiscussnetSspMessage, openaiApiKey);
      break;
    case "scraper":
      // 汎用 2フェーズハンドラー（adapter registry 経由で処理）
      if (msg.type === "scraper:list") {
        await handleGenericList(db, queue, msg);
      } else if (msg.type === "scraper:detail") {
        await handleGenericDetail(db, msg, openaiApiKey);
      }
      break;
    default:
      console.warn(`[scraper-worker] unknown message type:`, msg.type);
  }
}

async function handleDiscussnetSsp(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: DiscussnetSspMessage,
  openaiApiKey?: string
): Promise<void> {
  switch (msg.type) {
    case "discussnet-ssp:schedule":
      await handleDiscussnetSspSchedule(db, queue, msg);
      break;
    case "discussnet-ssp:minute":
      await handleDiscussnetSspMinute(db, msg, openaiApiKey);
      break;
  }
}

/**
 * PostgreSQL エラーから詳細情報を抽出する。
 * postgres.js の "Failed query: ..." フォーマットだけでは原因が不明なため、
 * code / detail / severity があれば付与する。
 */
function formatErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const pg = err as Error & {
    code?: string;
    detail?: string;
    severity?: string;
  };
  let msg = pg.message;
  if (pg.code) msg += ` [code=${pg.code}]`;
  if (pg.severity) msg += ` [severity=${pg.severity}]`;
  if (pg.detail) msg += ` [detail=${pg.detail}]`;
  return msg;
}

/**
 * メッセージ処理中のエラーを共通の方法で処理する。
 *
 * DB 接続が切れている場合に updateScraperJobStatus も失敗しうるため、
 * try-catch でラップして Worker クラッシュを防止する。
 */
export async function handleMessageError(
  db: Db,
  msg: ScraperQueueMessage,
  err: unknown
): Promise<void> {
  const errorMessage = formatErrorMessage(err);
  console.error(
    `[scraper-worker] handler error for type=${msg.type}:`,
    errorMessage
  );
  if ("jobId" in msg) {
    try {
      await updateScraperJobStatus(db, msg.jobId, "failed", { errorMessage });
    } catch (updateErr) {
      console.error(
        `[scraper-worker] failed to update job status for jobId=${msg.jobId}:`,
        formatErrorMessage(updateErr)
      );
    }
  }
}
