/**
 * 飯塚市議会 — detail ハンドラー
 *
 * 会議詳細ページを取得し、セッション日ごとの PDF URL を抽出して
 * meetings テーブルに保存する。
 *
 * 1つの詳細ページに複数のセッション日 PDF が含まれるため、
 * saveMeetings でまとめて保存する。
 */

import type { Db } from "@open-gikai/db";
import {
  createJobLogger,
  addJobStats,
  completeJobIfDone,
} from "../../../utils/job-logger";
import { saveMeetings } from "../../../utils/save-meetings";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMeetingDetails } from "@open-gikai/scrapers/iizuka";

const INTER_REQUEST_DELAY_MS = 1500;

export async function handleIizukaDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "iizuka:detail" }>,
  _openaiApiKey?: string
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetings = await fetchMeetingDetails(
    msg.detailUrl,
    msg.municipalityId,
    msg.pageId,
    msg.listTitle
  );

  if (meetings.length === 0) {
    await logger.warn(
      `飯塚市 [${msg.municipalityName}] PDF未公開または取得失敗: ${msg.listTitle}`
    );
    await addJobStats(db, msg.jobId, 0, 0);
    await completeJobIfDone(db, msg.jobId);
    return;
  }

  const { inserted, skipped } = await saveMeetings(db, meetings);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger.info(
      `飯塚市 [${msg.municipalityName}] ${inserted} 件保存: ${msg.listTitle}`
    );
  }

  await completeJobIfDone(db, msg.jobId);
  await delay(INTER_REQUEST_DELAY_MS);
}
