/**
 * DiscussNet SSP — minute ハンドラー
 *
 * schedule ごとの議事録本文を取得し、meetings テーブルに保存した後、
 * statements に変換する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats } from "../../../utils/job-logger";
import { saveMeetings } from "../../../utils/save-meetings";
import { applyStatementsToMeeting } from "../../../utils/apply-statements";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMinuteData } from "./scraper";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleDiscussnetSspMinute(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "discussnet-ssp:minute" }>,
  openaiApiKey?: string
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await fetchMinuteData(
    msg.tenantId,
    msg.tenantSlug,
    msg.councilId,
    msg.councilName,
    {
      scheduleId: msg.scheduleId,
      name: msg.scheduleName,
      memberList: msg.memberList,
    },
    msg.municipalityId
  );

  if (!meetingData) {
    await logger.warn(
      `DiscussNet SSP [${msg.municipalityName}] 議事録取得失敗または本文なし: ` +
        `council_id=${msg.councilId} schedule_id=${msg.scheduleId}`
    );
    return;
  }

  const { inserted, skipped, insertedIds } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger.info(
      `DiscussNet SSP [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  if (insertedIds[0]) {
    const parsedStatements = meetingData.statements;
    await applyStatementsToMeeting(db, insertedIds[0], parsedStatements, openaiApiKey);
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
