/**
 * DiscussNet SSP ハンドラー
 *
 * キューメッセージの種別に応じて 2 種類の処理を行う:
 *   - discussnet-ssp-schedule: council_id ごとに schedule 一覧を取得し、
 *                              discussnet-ssp-minute としてキューに投入
 *   - discussnet-ssp-minute:   schedule ごとの議事録本文を取得し、meetings テーブルに保存
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats } from "../utils/job-logger";
import { saveMeetings } from "../utils/save-meetings";
import {
  fetchSchedules,
  fetchMinuteData,
} from "../scrapers/discussnet-ssp";
import { delay } from "../utils/delay";
import type { ScraperQueueMessage } from "../utils/types";

const INTER_REQUEST_DELAY_MS = 1000;

/** discussnet-ssp-schedule メッセージの処理 */
export async function handleDiscussnetSspSchedule(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "discussnet-ssp-schedule" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger(
    "info",
    `DiscussNet SSP [${msg.municipalityName}] schedule 一覧取得中: council_id=${msg.councilId} (${msg.councilName})`
  );

  const schedules = await fetchSchedules(msg.tenantId, msg.councilId);

  if (schedules.length === 0) {
    await logger(
      "warn",
      `DiscussNet SSP [${msg.municipalityName}] schedule が見つかりません: council_id=${msg.councilId}`
    );
    return;
  }

  await logger(
    "info",
    `DiscussNet SSP [${msg.municipalityName}] ${schedules.length} 件の schedule を検出`
  );

  for (const schedule of schedules) {
    await queue.send({
      type: "discussnet-ssp-minute",
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      prefecture: msg.prefecture,
      tenantSlug: msg.tenantSlug,
      tenantId: msg.tenantId,
      councilId: msg.councilId,
      councilName: msg.councilName,
      scheduleId: schedule.scheduleId,
      scheduleName: schedule.name,
      memberList: schedule.memberList,
    });
  }

  await delay(INTER_REQUEST_DELAY_MS);
}

/** discussnet-ssp-minute メッセージの処理 */
export async function handleDiscussnetSspMinute(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "discussnet-ssp-minute" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const meetingData = await fetchMinuteData(
    msg.tenantId,
    msg.tenantSlug,
    msg.councilId,
    msg.councilName,
    { scheduleId: msg.scheduleId, name: msg.scheduleName, memberList: msg.memberList },
    msg.municipalityId
  );

  if (!meetingData) {
    await logger(
      "warn",
      `DiscussNet SSP [${msg.municipalityName}] 議事録取得失敗または本文なし: ` +
        `council_id=${msg.councilId} schedule_id=${msg.scheduleId}`
    );
    return;
  }

  const { inserted, skipped } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger(
      "info",
      `DiscussNet SSP [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
