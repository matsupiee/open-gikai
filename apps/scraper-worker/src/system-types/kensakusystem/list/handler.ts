/**
 * kensakusystem.jp — list ハンドラー
 *
 * URL タイプに応じて議事録スケジュール一覧を取得し、
 * kensakusystem:detail としてキューに投入する。
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addTotalItems, updateJobStatus } from "../../../utils/job-logger";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import {
  extractSlugFromUrl,
  isSapphireType,
  isCgiType,
  isIndexHtmlType,
  fetchFromSapphire,
  fetchFromCgi,
  fetchFromIndexHtml,
} from "@open-gikai/scrapers/kensakusystem";

const INTER_REQUEST_DELAY_MS = 1000;

export async function handleKensakusystemList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "kensakusystem:list" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger.info(
    `kensakusystem [${msg.municipalityName}] 議事録一覧取得中: ${msg.baseUrl}`
  );

  const slug = extractSlugFromUrl(msg.baseUrl);
  if (!slug) {
    await logger.error(
      `kensakusystem [${msg.municipalityName}] slug を抽出できません: ${msg.baseUrl}`
    );
    await updateJobStatus(db, msg.jobId, "failed", {
      errorMessage: `slug 抽出失敗: ${msg.baseUrl}`,
    });
    return;
  }

  let schedules: Array<{ title: string; heldOn: string; url: string }> | null =
    null;

  if (isSapphireType(msg.baseUrl)) {
    schedules = await fetchFromSapphire(msg.baseUrl);
  } else if (isCgiType(msg.baseUrl)) {
    schedules = await fetchFromCgi(msg.baseUrl);
  } else if (isIndexHtmlType(msg.baseUrl)) {
    schedules = await fetchFromIndexHtml(msg.baseUrl);
  } else {
    const indexUrl = msg.baseUrl.endsWith("/")
      ? `${msg.baseUrl}index.html`
      : `${msg.baseUrl}/index.html`;
    schedules = await fetchFromIndexHtml(indexUrl);
  }

  if (!schedules || schedules.length === 0) {
    await logger.warn(
      `kensakusystem [${msg.municipalityName}] 議事録が見つかりません`
    );
    await updateJobStatus(db, msg.jobId, "completed");
    return;
  }

  const yearPrefix = String(msg.year);
  const filtered = schedules.filter((s) => s.heldOn.startsWith(yearPrefix));

  await logger.info(
    `kensakusystem [${msg.municipalityName}] ${filtered.length} 件の議事録を検出 (${schedules.length} 件中 ${msg.year} 年分)`
  );

  if (filtered.length === 0) {
    await logger.warn(
      `kensakusystem [${msg.municipalityName}] ${msg.year} 年の議事録が見つかりません`
    );
    await updateJobStatus(db, msg.jobId, "completed");
    return;
  }

  for (const schedule of filtered) {
    await queue.send({
      type: "kensakusystem:detail",
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      slug,
      title: schedule.title,
      heldOn: schedule.heldOn,
      detailUrl: schedule.url,
    });
  }

  await addTotalItems(db, msg.jobId, filtered.length);

  await delay(INTER_REQUEST_DELAY_MS);
}
