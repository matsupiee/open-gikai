/**
 * dbsr.jp — detail ハンドラー
 *
 * 議事録詳細ページを取得し、meetings テーブルに保存した後、
 * statements に変換する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats, completeJobIfDone } from "../../../utils/job-logger";
import { saveMeetings } from "../../../utils/save-meetings";
import { applyStatementsToMeeting } from "../../../utils/apply-statements";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMeetingDetail } from "@open-gikai/scrapers/dbsearch";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleDbsearchDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "dbsearch:detail" }>,
  openaiApiKey?: string
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await fetchMeetingDetail(
    msg.detailUrl,
    msg.municipalityId,
    msg.meetingId,
    msg.listTitle
  );

  if (!meetingData) {
    await logger.warn(
      `dbsr.jp [${msg.municipalityName}] 議事録取得失敗または本文なし: ${msg.detailUrl}`
    );
    await addJobStats(db, msg.jobId, 0, 0);
    await completeJobIfDone(db, msg.jobId);
    return;
  }

  const { inserted, skipped, insertedIds } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger.info(
      `dbsr.jp [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  if (insertedIds[0]) {
    const parsedStatements = meetingData.statements;
    await applyStatementsToMeeting(db, insertedIds[0], parsedStatements, openaiApiKey);
  }

  await completeJobIfDone(db, msg.jobId);

  await delay(INTER_REQUEST_DELAY_MS);
}
