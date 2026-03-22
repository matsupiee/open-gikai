/**
 * 飯塚市議会 — list フェーズ
 *
 * 1. list18.html から年度別ページ URL を取得
 * 2. 対象年度ページから会議詳細ページのリンク一覧を取得
 * 3. 各詳細ページからセッション日 PDF URL を抽出
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでセッション日ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseNendo,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface IizukaSessionInfo {
  /** 会議タイトル（例: "第2回定例会 6月12日（第1号）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページの記事 ID */
  pageId: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全セッション日を収集する。
 * baseUrl から年度インデックス → 年度ページ → 各詳細ページを辿る。
 */
export async function fetchSessionList(
  baseUrl: string,
  year: number
): Promise<IizukaSessionInfo[]> {
  // Step 1: 年度インデックスページから年度ページ URL を特定
  const indexUrl = `${baseUrl.replace(/\/$/, "")}/list18.html`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPages = parseYearPages(indexHtml);
  const yearPageUrl = yearPages.find((p) => p.nendo === year)?.url;
  if (!yearPageUrl) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // Step 2: 年度ページから会議詳細ページリンクを取得
  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  const meetingLinks = parseMeetingLinks(yearHtml);

  // Step 3: 各詳細ページからセッション日 PDF を抽出
  const allSessions: IizukaSessionInfo[] = [];

  for (const link of meetingLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const detailHtml = await fetchPage(link.url);
    if (!detailHtml) continue;

    // PDF 未公開ページをスキップ
    if (
      detailHtml.includes("作成次第、掲載いたします") &&
      !detailHtml.includes("/uploaded/attachment/")
    ) {
      continue;
    }

    const sessions = extractSessionRecords(detailHtml, link.title, link.pageId);
    allSessions.push(...sessions);
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

export interface YearPageLink {
  nendo: number;
  url: string;
}

/**
 * list18.html から年度ページリンクを抽出する。
 */
export function parseYearPages(html: string): YearPageLink[] {
  const pages: YearPageLink[] = [];

  const pattern =
    /<a\s[^>]*href="(\/site\/shigikai\/list18-(\d+)\.html)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1]!;
    const linkText = m[3]!.trim();
    const nendo = parseNendo(linkText);
    if (nendo !== null) {
      pages.push({
        nendo,
        url: `${BASE_ORIGIN}${path}`,
      });
    }
  }

  return pages;
}

export interface MeetingLink {
  title: string;
  url: string;
  pageId: string;
}

/**
 * 年度ページから会議詳細ページリンクを抽出する。
 */
export function parseMeetingLinks(html: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  const pattern =
    /<a\s[^>]*href="\/site\/shigikai\/(\d+)\.html"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const pageId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    links.push({
      title,
      url: `${BASE_ORIGIN}/site/shigikai/${pageId}.html`,
      pageId,
    });
  }

  return links;
}

/**
 * 詳細ページ HTML からセッション日ごとの PDF レコードを抽出する。
 *
 * フィルタリング:
 *   - 会期日程 / 議案付託一覧表 / 目次 は除外
 *   - 「N月N日」パターンを含むセッション日 PDF のみ対象
 */
export function extractSessionRecords(
  html: string,
  listTitle: string,
  pageId: string
): IizukaSessionInfo[] {
  const records: IizukaSessionInfo[] = [];
  const year = parseWarekiYear(listTitle);
  if (!year) return records;

  const meetingType = detectMeetingType(listTitle);
  const baseMeetingName = listTitle.replace(/\(.*?\)|（.*?）/g, "").trim();

  const pdfPattern =
    /<a\s[^>]*href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const pdfPath = m[1]!;
    const linkText = m[2]!.trim();

    // 会期日程・議案付託一覧表・目次を除外
    if (
      linkText.includes("日程") ||
      linkText.includes("一覧") ||
      linkText.includes("目次")
    ) {
      continue;
    }

    // セッション日パターン: 「N月N日」
    const dateMatch = linkText.match(/(\d{1,2})月(\d{1,2})日/);
    if (!dateMatch) continue;

    const month = parseInt(dateMatch[1]!, 10);
    const day = parseInt(dateMatch[2]!, 10);

    // 年度をまたぐケース（12月開催 → 1月セッション等）
    const openingMonth = parseOpeningMonth(listTitle);
    let sessionYear = year;
    if (openingMonth !== null && openingMonth >= 10 && month <= 3) {
      sessionYear = year + 1;
    }

    const heldOn = `${sessionYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const sessionMatch = linkText.match(/第(\d+)号/);
    const sessionLabel = sessionMatch?.[1]
      ? `${month}月${day}日（第${sessionMatch[1]}号）`
      : `${month}月${day}日`;

    records.push({
      title: `${baseMeetingName} ${sessionLabel}`,
      heldOn,
      pdfUrl: `${BASE_ORIGIN}${pdfPath}`,
      meetingType,
      pageId,
    });
  }

  return records;
}

function parseOpeningMonth(listTitle: string): number | null {
  const m = listTitle.match(/(\d{1,2})月開催/);
  return m?.[1] ? parseInt(m[1], 10) : null;
}
