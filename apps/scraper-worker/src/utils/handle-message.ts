import type { Db } from "@open-gikai/db";
import type { ScraperQueueMessage } from "./types";
import { updateScraperJobStatus } from "./job-logger";
import { handleDiscussnetSspSchedule } from "../system-types/discussnet-ssp/schedule/handler";
import { handleDiscussnetSspMinute } from "../system-types/discussnet-ssp/minute/handler";
import { handleDbsearchList } from "../system-types/dbsearch/list/handler";
import { handleDbsearchDetail } from "../system-types/dbsearch/detail/handler";
import { handleKensakusystemList } from "../system-types/kensakusystem/list/handler";
import { handleKensakusystemDetail } from "../system-types/kensakusystem/detail/handler";
import { handleGijirokuComList } from "../system-types/gijiroku-com/list/handler";
import { handleGijirokuComDetail } from "../system-types/gijiroku-com/detail/handler";
import { handleIizukaList } from "../system-types/iizuka/list/handler";
import { handleIizukaDetail } from "../system-types/iizuka/detail/handler";

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
type GijirokuComMessage = Extract<
  ScraperQueueMessage,
  { type: `gijiroku-com:${string}` }
>;
type IizukaMessage = Extract<
  ScraperQueueMessage,
  { type: `iizuka:${string}` }
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
    case "gijiroku-com":
      await handleGijirokuCom(db, queue, msg as GijirokuComMessage, openaiApiKey);
      break;
    case "iizuka":
      await handleIizuka(db, queue, msg as IizukaMessage, openaiApiKey);
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

async function handleGijirokuCom(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: GijirokuComMessage,
  openaiApiKey?: string
): Promise<void> {
  switch (msg.type) {
    case "gijiroku-com:list":
      await handleGijirokuComList(db, queue, msg);
      break;
    case "gijiroku-com:detail":
      await handleGijirokuComDetail(db, msg, openaiApiKey);
      break;
  }
}

async function handleIizuka(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: IizukaMessage,
  openaiApiKey?: string
): Promise<void> {
  switch (msg.type) {
    case "iizuka:list":
      await handleIizukaList(db, queue, msg);
      break;
    case "iizuka:detail":
      await handleIizukaDetail(db, msg, openaiApiKey);
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
