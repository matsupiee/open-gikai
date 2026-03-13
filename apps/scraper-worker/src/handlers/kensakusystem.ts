/**
 * kensakusystem.jp ハンドラー
 *
 * キューメッセージの種別に応じて 2 種類の処理を行う:
 *   - kensakusystem-list: baseUrl を取得し、URL タイプに応じて議事録一覧を取得、
 *                        kensakusystem-detail としてキューに投入
 *   - kensakusystem-detail: 議事録詳細ページを取得・保存
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats } from "../utils/job-logger";
import { saveMeetings } from "../utils/save-meetings";
import {
  extractSlugFromUrl,
  isSapphireType,
  isCgiType,
  isIndexHtmlType,
  fetchFromSapphire,
  fetchFromCgi,
  fetchFromIndexHtml,
  fetchMeetingDataFromSchedule,
} from "../scrapers/kensakusystem";
import { delay } from "../utils/delay";
import type { ScraperQueueMessage } from "../utils/types";

const INTER_REQUEST_DELAY_MS = 1000;

/** kensakusystem-list メッセージの処理 */
export async function handleKensakusystemList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "kensakusystem-list" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger(
    "info",
    `kensakusystem [${msg.municipalityName}] 議事録一覧取得中: ${msg.baseUrl}`
  );

  const slug = extractSlugFromUrl(msg.baseUrl);
  if (!slug) {
    await logger(
      "error",
      `kensakusystem [${msg.municipalityName}] slug を抽出できません: ${msg.baseUrl}`
    );
    return;
  }

  // URL タイプに応じて議事録一覧を取得
  let schedules: Array<{
    title: string;
    heldOn: string;
    url: string;
  }> | null = null;

  if (isSapphireType(msg.baseUrl)) {
    schedules = await fetchFromSapphire(msg.baseUrl);
  } else if (isCgiType(msg.baseUrl)) {
    schedules = await fetchFromCgi(msg.baseUrl);
  } else if (isIndexHtmlType(msg.baseUrl)) {
    schedules = await fetchFromIndexHtml(msg.baseUrl);
  } else {
    // ルート URL の場合、index.html として取得
    const indexUrl = msg.baseUrl.endsWith("/")
      ? `${msg.baseUrl}index.html`
      : `${msg.baseUrl}/index.html`;
    schedules = await fetchFromIndexHtml(indexUrl);
  }

  if (!schedules || schedules.length === 0) {
    await logger(
      "warn",
      `kensakusystem [${msg.municipalityName}] 議事録が見つかりません`
    );
    return;
  }

  await logger(
    "info",
    `kensakusystem [${msg.municipalityName}] ${schedules.length} 件の議事録を検出`
  );

  for (const schedule of schedules) {
    await queue.send({
      type: "kensakusystem-detail",
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      slug,
      title: schedule.title,
      heldOn: schedule.heldOn,
      detailUrl: schedule.url,
    });
  }

  await delay(INTER_REQUEST_DELAY_MS);
}

/** kensakusystem-detail メッセージの処理 */
export async function handleKensakusystemDetail(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "kensakusystem-detail" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const schedule = {
    title: msg.title,
    heldOn: msg.heldOn,
    url: msg.detailUrl,
  };

  const meetingData = await fetchMeetingDataFromSchedule(
    schedule,
    msg.municipalityId,
    msg.slug
  );

  if (!meetingData) {
    await logger(
      "warn",
      `kensakusystem [${msg.municipalityName}] 議事録取得失敗または本文なし: ${msg.title}`
    );
    return;
  }

  const { inserted, skipped } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger(
      "info",
      `kensakusystem [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
