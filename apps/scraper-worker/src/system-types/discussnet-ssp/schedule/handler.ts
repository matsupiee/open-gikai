/**
 * DiscussNet SSP — schedule ハンドラー
 *
 * council_id ごとに schedule 一覧を取得し、
 * discussnet-ssp:minute としてキューに投入する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger } from "../../../utils/job-logger";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchSchedules } from "./scraper";

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

  const schedules = await fetchSchedules(msg.tenantId, msg.councilId);

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
    });
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
