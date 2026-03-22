/**
 * 汎用 detail ハンドラー。
 *
 * ScraperAdapter を通じて議事録詳細を取得・保存する。
 * 個別の system-type ごとに detail handler を作る必要がなくなる。
 */

import type { Db } from "@open-gikai/db";
import {
  createJobLogger,
  addJobStats,
  completeJobIfDone,
} from "../utils/job-logger";
import { saveMeetings } from "../utils/save-meetings";
import { applyStatementsToMeeting } from "../utils/apply-statements";
import { delay } from "../utils/delay";
import type { ScraperQueueMessage } from "../utils/types";
import { getAdapter } from "../adapters/registry";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleGenericDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "scraper:detail" }>,
  openaiApiKey?: string
): Promise<void> {
  const adapter = getAdapter(msg.systemType);
  if (!adapter) {
    const logger = createJobLogger(db, msg.jobId);
    await logger.error(`未登録の adapter: ${msg.systemType}`);
    await addJobStats(db, msg.jobId, 0, 0);
    await completeJobIfDone(db, msg.jobId);
    return;
  }

  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await adapter.fetchDetail({
    detailParams: msg.detailParams,
    municipalityId: msg.municipalityId,
  });

  if (!meetingData) {
    await logger.warn(
      `${msg.systemType} [${msg.municipalityName}] 議事録取得失敗または本文なし`
    );
    await addJobStats(db, msg.jobId, 0, 0);
    await completeJobIfDone(db, msg.jobId);
    return;
  }

  const { inserted, skipped, insertedIds } = await saveMeetings(db, [
    meetingData,
  ]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger.info(
      `${msg.systemType} [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  if (insertedIds[0]) {
    await applyStatementsToMeeting(
      db,
      insertedIds[0],
      meetingData.statements,
      openaiApiKey
    );
  }

  await completeJobIfDone(db, msg.jobId);
  await delay(INTER_REQUEST_DELAY_MS);
}
