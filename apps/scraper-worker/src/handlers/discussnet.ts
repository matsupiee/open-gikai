/**
 * DiscussNet ハンドラー
 *
 * キューメッセージの種別に応じて 2 種類の処理を行う:
 *   - discussnet-list:    議事録一覧ページを取得し、個別リンクを discussnet-meeting としてキューに投入
 *   - discussnet-meeting: 個別議事録ページを取得し、meetings テーブルに保存
 */

import type { Db } from "@open-gikai/db";
import { createJobLogger, addJobStats } from "../db/job-logger";
import { saveMeetings } from "../db/save-meetings";
import {
  buildListUrl,
  detectNextPageUrl,
  extractMeetingLinks,
  fetchDiscussnet,
  parseMeetingPage,
} from "../scrapers/discussnet";
import { delay } from "../utils/delay";
import type { ScraperQueueMessage } from "../utils/types";

const INTER_REQUEST_DELAY_MS = 2000; // 同一サーバーへのウェイト

/** discussnet-list メッセージの処理 */
export async function handleDiscussnetList(
  db: Db,
  queue: Queue<ScraperQueueMessage>,
  msg: Extract<ScraperQueueMessage, { type: "discussnet-list" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const listUrl = msg.page === 1
    ? buildListUrl(msg.baseUrl, msg.year)
    : msg.baseUrl; // ページ 2 以降は baseUrl に次ページ URL が入る

  await logger(
    "info",
    `DiscussNet [${msg.municipalityName}] 一覧ページ取得中: ${listUrl}`
  );

  const html = await fetchDiscussnet(listUrl);
  if (!html) {
    await logger(
      "warn",
      `DiscussNet [${msg.municipalityName}] 一覧ページ取得失敗: ${listUrl}`
    );
    return;
  }

  const links = extractMeetingLinks(html, listUrl);

  await logger(
    "info",
    `DiscussNet [${msg.municipalityName}] ${links.length} 件の議事録リンクを検出`
  );

  // 個別議事録をキューに投入
  for (const meetingUrl of links) {
    await queue.send({
      type: "discussnet-meeting",
      jobId: msg.jobId,
      municipalityId: msg.municipalityId,
      municipalityName: msg.municipalityName,
      prefecture: msg.prefecture,
      meetingUrl,
    });
  }

  // 次ページがあればキューに投入
  {
    const nextUrl = detectNextPageUrl(html, listUrl);
    if (nextUrl) {
      await logger(
        "info",
        `DiscussNet [${msg.municipalityName}] 次ページをキューに投入: ${nextUrl}`
      );
      await queue.send({
        type: "discussnet-list",
        jobId: msg.jobId,
        municipalityId: msg.municipalityId,
        municipalityName: msg.municipalityName,
        prefecture: msg.prefecture,
        baseUrl: nextUrl,
        year: msg.year,
        page: msg.page + 1,
      });
    }
  }

  await delay(INTER_REQUEST_DELAY_MS);
}

/** discussnet-meeting メッセージの処理 */
export async function handleDiscussnetMeeting(
  db: Db,
  msg: Extract<ScraperQueueMessage, { type: "discussnet-meeting" }>
): Promise<void> {
  const logger = createJobLogger(db, msg.jobId);

  const html = await fetchDiscussnet(msg.meetingUrl);
  if (!html) {
    await logger(
      "warn",
      `DiscussNet [${msg.municipalityName}] 議事録取得失敗: ${msg.meetingUrl}`
    );
    return;
  }

  const meetingData = parseMeetingPage(
    html,
    msg.meetingUrl,
    msg.municipalityName,
    msg.prefecture
  );

  if (!meetingData) {
    await logger(
      "warn",
      `DiscussNet [${msg.municipalityName}] パース失敗（日付または本文なし）: ${msg.meetingUrl}`
    );
    return;
  }

  const { inserted, skipped } = await saveMeetings(db, [meetingData]);
  await addJobStats(db, msg.jobId, inserted, skipped);

  if (inserted > 0) {
    await logger(
      "info",
      `DiscussNet [${msg.municipalityName}] 保存: ${meetingData.title} (${meetingData.heldOn})`
    );
  }

  await delay(INTER_REQUEST_DELAY_MS);
}
