/**
 * gijiroku.com — detail ハンドラー
 *
 * voiweb.exe CGI から議事録本文を取得し、meetings テーブルに保存した後、
 * statements に変換する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats, completeJobIfDone } from "../../../utils/job-logger";
import { saveMeetings } from "../../../utils/save-meetings";
import { applyStatementsToMeeting } from "../../../utils/apply-statements";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMeetingDetail } from "./scraper";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleGijirokuComDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "gijiroku-com:detail" }>,
  openaiApiKey?: string
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await fetchMeetingDetail(
    msg.baseUrl,
    msg.fino,
    msg.municipalityId,
    msg.unid,
    msg.title,
    msg.dateLabel
  );

  if (!meetingData) {
    await logger.warn(
      `gijiroku.com [${msg.municipalityName}] 議事録取得失敗または本文なし: FINO=${msg.fino}`
    );
    await addJobStats(db, msg.jobId, 0, 0);
    await completeJobIfDone(db, msg.jobId);
    return;
  }

  const { inserted, skipped, insertedIds } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger.info(
      `gijiroku.com [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  if (insertedIds[0]) {
    const parsedStatements = meetingData.statements;
    await applyStatementsToMeeting(db, insertedIds[0], parsedStatements, openaiApiKey);
  }

  await completeJobIfDone(db, msg.jobId);

  await delay(INTER_REQUEST_DELAY_MS);
}
