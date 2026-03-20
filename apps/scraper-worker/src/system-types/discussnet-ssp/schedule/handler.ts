/**
 * DiscussNet SSP — schedule ハンドラー
 *
 * council_id ごとに schedule 一覧を取得し、
 * discussnet-ssp:minute としてキューに投入する。
 *
 * DiscussNet SSP の データ構造
 * - tenant: 自治体
 * - council: 会期（例: 令和7年第4回定例会 11月27日〜12月15日）
 * - schedule: 個別会議（例: 11月27日-01号）
 * - minute: 発言
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addTotalItems } from "../../../utils/job-logger";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchSchedules } from "@open-gikai/scrapers/discussnet-ssp";
import { buildApiBase } from "@open-gikai/scrapers/discussnet-ssp";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleDiscussnetSspSchedule(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "discussnet-ssp:schedule" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger.info(
    `DiscussNet SSP [${msg.municipalityName}] schedule 一覧取得中: council_id=${msg.councilId} (${msg.councilName})`
  );

  const apiBase = msg.host ? buildApiBase(`${msg.host}/`) : undefined;
  const schedules = await fetchSchedules(msg.tenantId, msg.councilId, apiBase);

  if (schedules.length === 0) {
    await logger.warn(
      `DiscussNet SSP [${msg.municipalityName}] schedule が見つかりません: council_id=${msg.councilId}`
    );
    return;
  }

  await logger.info(
    `DiscussNet SSP [${msg.municipalityName}] ${schedules.length} 件の schedule を検出`
  );

  for (const schedule of schedules) {
    await queue.send({
      type: "discussnet-ssp:minute",
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
      host: msg.host,
    });
  }

  await addTotalItems(db, msg.jobId, schedules.length);

  await delay(INTER_REQUEST_DELAY_MS);
}
