/**
 * 広川町議会（福岡県） — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 年度別一覧ページから個別会議ページへのリンクを抽出
 * 2. 各個別ページから PDF ダウンロードリンクとメタ情報を抽出
 */

import {
  BASE_ORIGIN,
  buildListUrl,
  detectMeetingType,
  fetchPage,
  parseDateText,
} from "./shared";

export interface HirokawaMeeting {
  /** PDF ダウンロード URL */
  pdfUrl: string;
  /** 会議タイトル（例: 令和6年 第1回(3月)定例会会議録） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別 plenary/extraordinary/committee */
  meetingType: string;
  /** 個別ページ URL（sourceUrl として利用） */
  pageUrl: string;
}

/**
 * 年度別一覧ページから個別会議ページへのリンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <a href="https://.../{dirId}/{pageId}.html">令和6年 第1回(1月)臨時会会議録</a>
 */
export function parseListPage(
  html: string,
): { title: string; pageUrl: string }[] {
  const results: { title: string; pageUrl: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]+\/\d+\.html)"[^>]*>([^<]*会議録[^<]*)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.replace(/\s+/g, " ").trim();

    let pageUrl: string;
    if (href.startsWith("http")) {
      pageUrl = href;
    } else if (href.startsWith("//")) {
      pageUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pageUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pageUrl = href;
    }

    results.push({ title, pageUrl });
  }

  return results;
}

/**
 * 個別会議ページから PDF リンクと開催日を抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <p class="file-link-item">
 *     <a class="pdf" href="//www.town.hirokawa.fukuoka.jp/material/files/group/37/R060105.pdf">
 *       令和6年 第1回（1月）臨時会会議録 令和6年1月5日 (PDFファイル: 322.1KB)
 *     </a>
 *   </p>
 */
export function parseDetailPage(
  html: string,
  meetingTitle: string,
  pageUrl: string,
): HirokawaMeeting[] {
  const results: HirokawaMeeting[] = [];
  const meetingType = detectMeetingType(meetingTitle);

  const linkRegex =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // PDF リンクテキストから日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = href;
    }

    results.push({
      pdfUrl,
      title: meetingTitle,
      heldOn,
      meetingType,
      pageUrl,
    });
  }

  return results;
}

/**
 * 指定年度の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HirokawaMeeting[]> {
  // Step 1: 年度別一覧ページから個別ページリンクを取得
  const listUrl = buildListUrl(baseUrl, year);
  const listHtml = await fetchPage(listUrl);
  if (!listHtml) return [];

  const pages = parseListPage(listHtml);
  if (pages.length === 0) return [];

  // Step 2: 各個別ページから PDF リンクを抽出
  const allMeetings: HirokawaMeeting[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const detailHtml = await fetchPage(page.pageUrl);
    if (!detailHtml) continue;

    const meetings = parseDetailPage(detailHtml, page.title, page.pageUrl);
    allMeetings.push(...meetings);

    // レート制限: 最後のリクエスト後は待たない
    if (i < pages.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allMeetings;
}
