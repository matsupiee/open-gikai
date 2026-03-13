/**
 * dbsr.jp — detail ハンドラー
 *
 * 議事録詳細ページを取得し、meetings テーブルに保存する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats } from "../../../utils/job-logger";
import { saveMeetings } from "../../../utils/save-meetings";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMeetingDetail } from "./scraper";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleDbsearchDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "dbsearch:detail" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await fetchMeetingDetail(
    msg.detailUrl,
    msg.municipalityId,
    msg.meetingId
  );

  if (!meetingData) {
    await logger.warn(
      `dbsr.jp [${msg.municipalityName}] 議事録取得失敗または本文なし: ${msg.detailUrl}`
    );
    return;
  }

  const { inserted, skipped } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger.info(
      `dbsr.jp [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
