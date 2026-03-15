/**
 * kensakusystem.jp — detail ハンドラー
 *
 * 議事録詳細ページを取得し、meetings テーブルに保存した後、
 * statements に変換する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats } from "../../../utils/job-logger";
import { saveMeetings } from "../../../utils/save-meetings";
import { applyStatementsToMeeting } from "../../../utils/apply-statements";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMeetingDataFromSchedule } from "./scraper";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleKensakusystemDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "kensakusystem:detail" }>,
  openaiApiKey?: string
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await fetchMeetingDataFromSchedule(
    { title: msg.title, heldOn: msg.heldOn, url: msg.detailUrl },
    msg.municipalityId,
    msg.slug
  );

  if (!meetingData) {
    await logger.warn(
      `kensakusystem [${msg.municipalityName}] 議事録取得失敗または本文なし: ${msg.title}`
    );
    return;
  }

  const { inserted, skipped, insertedIds } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger.info(
      `kensakusystem [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  if (insertedIds[0]) {
    const parsedStatements = meetingData.statements;
    await applyStatementsToMeeting(db, insertedIds[0], parsedStatements, openaiApiKey);
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
