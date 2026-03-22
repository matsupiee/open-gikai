/**
 * 汎用 list ハンドラー。
 *
 * ScraperAdapter を通じて一覧を取得し、detail メッセージとしてキューに投入する。
 * 個別の system-type ごとに list handler を作る必要がなくなる。
 */

import type { Db } from "@open-gikai/db";
import {
  createJobLogger,
  addTotalItems,
  updateJobStatus,
} from "../utils/job-logger";
import { delay } from "../utils/delay";
import type { ScraperQueueMessage } from "../utils/types";
import { getAdapter } from "../adapters/registry";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleGenericList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "scraper:list" }>
): Promise<void> {
  const adapter = getAdapter(msg.systemType);
  if (!adapter) {
    const logger = createJobLogger(db, msg.jobId);
    await logger.error(
      `未登録の adapter: ${msg.systemType}`
    );
    await updateJobStatus(db, msg.jobId, "failed", {
      errorMessage: `未登録の adapter: ${msg.systemType}`,
    });
    return;
  }

  const logger = createJobLogger(db, msg.jobId);

  await logger.info(
    `${msg.systemType} [${msg.municipalityName}] 議事録一覧取得中: ${msg.baseUrl} (${msg.year}年)`
  );

  let records;
  try {
    records = await adapter.fetchList({
      baseUrl: msg.baseUrl,
      year: msg.year,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logger.error(
      `${msg.systemType} [${msg.municipalityName}] 一覧取得エラー: ${errorMessage}`
    );
    await updateJobStatus(db, msg.jobId, "failed", { errorMessage });
    return;
  }

  if (records.length === 0) {
    await logger.warn(
      `${msg.systemType} [${msg.municipalityName}] 議事録が見つかりません: ${msg.baseUrl}`
    );
    await updateJobStatus(db, msg.jobId, "completed");
    return;
  }

  await logger.info(
    `${msg.systemType} [${msg.municipalityName}] ${records.length} 件の議事録を検出`
  );

  for (const record of records) {
    await queue.send({
      type: "scraper:detail",
      systemType: msg.systemType,
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      prefecture: msg.prefecture,
      detailParams: record.detailParams,
    });
  }

  await addTotalItems(db, msg.jobId, records.length);
  await delay(INTER_REQUEST_DELAY_MS);
}
