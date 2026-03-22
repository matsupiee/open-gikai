/**
 * 飯塚市議会 — list ハンドラー
 *
 * 年度別インデックスから会議詳細ページの URL 一覧を取得し、
 * iizuka:detail としてキューに投入する。
 */

import type { Db } from "@open-gikai/db";
import {
  createJobLogger,
  addTotalItems,
  updateJobStatus,
} from "../../../utils/job-logger";
import { delay } from "../../../utils/delay";
import type { ScraperQueueMessage } from "../../../utils/types";
import {
  fetchYearPages,
  fetchMeetingLinks,
  findYearPageUrl,
} from "@open-gikai/scrapers/iizuka";

const INTER_REQUEST_DELAY_MS = 1500;

export async function handleIizukaList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "iizuka:list" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  await logger.info(
    `飯塚市 [${msg.municipalityName}] 年度別インデックス取得中: ${msg.baseUrl} (${msg.year}年度)`
  );

  // Step 1: 全年度ページを取得
  const yearPages = await fetchYearPages(msg.baseUrl);
  if (yearPages.length === 0) {
    await logger.error(
      `飯塚市 [${msg.municipalityName}] 年度インデックスの取得に失敗しました`
    );
    await updateJobStatus(db, msg.jobId, "failed", {
      errorMessage: "年度インデックス取得失敗",
    });
    return;
  }

  // Step 2: 対象年度のページ URL を特定
  const yearPageUrl = findYearPageUrl(yearPages, msg.year);
  if (!yearPageUrl) {
    await logger.warn(
      `飯塚市 [${msg.municipalityName}] ${msg.year}年度のページが見つかりません`
    );
    await updateJobStatus(db, msg.jobId, "completed");
    return;
  }

  await delay(INTER_REQUEST_DELAY_MS);

  // Step 3: 年度ページから会議詳細リンクを取得
  const meetingLinks = await fetchMeetingLinks(yearPageUrl);
  if (meetingLinks.length === 0) {
    await logger.warn(
      `飯塚市 [${msg.municipalityName}] ${msg.year}年度の会議が見つかりません`
    );
    await updateJobStatus(db, msg.jobId, "completed");
    return;
  }

  await logger.info(
    `飯塚市 [${msg.municipalityName}] ${meetingLinks.length} 件の会議を検出`
  );

  // Step 4: 各会議詳細ページをキューに投入
  for (const link of meetingLinks) {
    await queue.send({
      type: "iizuka:detail",
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      prefecture: msg.prefecture,
      baseUrl: msg.baseUrl,
      detailUrl: link.url,
      pageId: link.pageId,
      listTitle: link.title,
    });
  }

  await addTotalItems(db, msg.jobId, meetingLinks.length);
}
