/**
 * dbsr.jp — list ハンドラー
 *
 * baseUrl から議事録 ID 一覧を取得し、dbsearch:detail としてキューに投入する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger } from "../../../utils/job-logger";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMeetingList } from "./scraper";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleDbsearchList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "dbsearch:list" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger.info(
    `dbsr.jp [${msg.municipalityName}] 議事録一覧取得中: ${msg.baseUrl} (${msg.year}年)`
  );

  const records = await fetchMeetingList(msg.baseUrl, msg.year);

  if (!records || records.length === 0) {
    await logger.warn(
      `dbsr.jp [${msg.municipalityName}] 議事録が見つかりません: ${msg.baseUrl}`
    );
    return;
  }

  await logger.info(
    `dbsr.jp [${msg.municipalityName}] ${records.length} 件の議事録を検出`
  );

  for (const record of records) {
    await queue.send({
      type: "dbsearch:detail",
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      prefecture: msg.prefecture,
      baseUrl: msg.baseUrl,
      meetingId: record.id,
      detailUrl: record.url,
    });
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
