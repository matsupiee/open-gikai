/**
 * gijiroku.com — list ハンドラー
 *
 * baseUrl から voiweb.exe CGI 経由で会議一覧を取得し、
 * gijiroku-com:detail としてキューに投入する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger } from "../../../utils/job-logger";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import { fetchMeetingList } from "./scraper";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleGijirokuComList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "gijiroku-com:list" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger.info(
    `gijiroku.com [${msg.municipalityName}] 会議一覧取得中: ${msg.baseUrl} (${msg.year}年)`
  );

  const records = await fetchMeetingList(msg.baseUrl, msg.year);

  if (!records || records.length === 0) {
    await logger.warn(
      `gijiroku.com [${msg.municipalityName}] 会議が見つかりません: ${msg.baseUrl}`
    );
    return;
  }

  await logger.info(
    `gijiroku.com [${msg.municipalityName}] ${records.length} 件の会議を検出`
  );

  for (const record of records) {
    await queue.send({
      type: "gijiroku-com:detail",
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      prefecture: msg.prefecture,
      baseUrl: msg.baseUrl,
      fino: record.fino,
      kgno: record.kgno,
      unid: record.unid,
      title: record.title,
      dateLabel: record.dateLabel,
    });
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
