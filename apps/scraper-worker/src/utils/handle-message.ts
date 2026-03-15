import type { Db } from "@open-gikai/db";
import type { ScraperQueueMessage } from "./types";
import { updateScraperJobStatus } from "./job-logger";
import { handleDiscussnetSspSchedule } from "../system-types/discussnet-ssp/schedule/handler";
import { handleDiscussnetSspMinute } from "../system-types/discussnet-ssp/minute/handler";
import { handleDbsearchList } from "../system-types/dbsearch/list/handler";
import { handleDbsearchDetail } from "../system-types/dbsearch/detail/handler";
import { handleKensakusystemList } from "../system-types/kensakusystem/list/handler";
import { handleKensakusystemDetail } from "../system-types/kensakusystem/detail/handler";

type DiscussnetSspMessage = Extract<
  ScraperQueueMessage,
  { type: `discussnet-ssp:${string}` }
>;
type DbsearchMessage = Extract<
  ScraperQueueMessage,
  { type: `dbsearch:${string}` }
>;
type KensakusystemMessage = Extract<
  ScraperQueueMessage,
  { type: `kensakusystem:${string}` }
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
    case "dbsearch":
      await handleDbsearch(db, queue, msg as DbsearchMessage, openaiApiKey);
      break;
    case "kensakusystem":
      await handleKensakusystem(db, queue, msg as KensakusystemMessage, openaiApiKey);
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

async function handleDbsearch(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: DbsearchMessage,
  openaiApiKey?: string
): Promise<void> {
  switch (msg.type) {
    case "dbsearch:list":
      await handleDbsearchList(db, queue, msg);
      break;
    case "dbsearch:detail":
      await handleDbsearchDetail(db, msg, openaiApiKey);
      break;
  }
}

async function handleKensakusystem(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: KensakusystemMessage,
  openaiApiKey?: string
): Promise<void> {
  switch (msg.type) {
    case "kensakusystem:list":
      await handleKensakusystemList(db, queue, msg);
      break;
    case "kensakusystem:detail":
      await handleKensakusystemDetail(db, msg, openaiApiKey);
      break;
  }
}

/**
 * メッセージ処理中のエラーを共通の方法で処理する。
 */
export async function handleMessageError(
  db: Db,
  msg: ScraperQueueMessage,
  err: unknown
): Promise<void> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error(
    `[scraper-worker] handler error for type=${msg.type}:`,
    errorMessage
  );
  if ("jobId" in msg) {
    await updateScraperJobStatus(db, msg.jobId, "failed", { errorMessage });
  }
}
