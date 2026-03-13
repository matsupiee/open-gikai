/**
 * dbsr.jp ハンドラー
 *
 * キューメッセージの種別に応じて 2 種類の処理を行う:
 *   - dbsearch-list:   baseUrl から議事録 ID 一覧を取得し、
 *                       dbsearch-detail としてキューに投入
 *   - dbsearch-detail: 議事録 ID ごとに詳細ページを取得し、
 *                       meetings テーブルに保存
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats } from "../utils/job-logger";
import { saveMeetings } from "../utils/save-meetings";
import {
  fetchMeetingList,
  fetchMeetingDetail,
} from "../scrapers/dbsearch";
import { delay } from "../utils/delay";
import type { ScraperQueueMessage } from "../utils/types";

const INTER_REQUEST_DELAY_MS = 1000;

/** dbsearch-list メッセージの処理 */
export async function handleDbsearchList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "dbsearch-list" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger(
    "info",
    `dbsr.jp [${msg.municipalityName}] 議事録一覧取得中: ${msg.baseUrl}`
  );

  const records = await fetchMeetingList(msg.baseUrl);

  if (!records || records.length === 0) {
    await logger(
      "warn",
      `dbsr.jp [${msg.municipalityName}] 議事録が見つかりません: ${msg.baseUrl}`
    );
    return;
  }

  await logger(
    "info",
    `dbsr.jp [${msg.municipalityName}] ${records.length} 件の議事録を検出`
  );

  for (const record of records) {
    await queue.send({
      type: "dbsearch-detail",
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

/** dbsearch-detail メッセージの処理 */
export async function handleDbsearchDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "dbsearch-detail" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await fetchMeetingDetail(
    msg.detailUrl,
    msg.municipalityId,
    msg.meetingId
  );

  if (!meetingData) {
    await logger(
      "warn",
      `dbsr.jp [${msg.municipalityName}] 議事録取得失敗または本文なし: ${msg.detailUrl}`
    );
    return;
  }

  const { inserted, skipped } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger(
      "info",
      `dbsr.jp [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
