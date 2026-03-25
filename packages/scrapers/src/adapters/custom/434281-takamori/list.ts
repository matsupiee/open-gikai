/**
 * 高森町議会 会議録 — list フェーズ
 *
 * 取得フロー:
 * 1. YEAR_PAGE_IDS から指定年に対応するページ ID を特定
 * 2. 年度別ページ（/site/gikai/{pageId}.html）にアクセス
 * 3. PDF リンク（/uploaded/attachment/{ID}.pdf）を収集
 * 4. リンクテキストから会議名・種別・月を抽出して返す
 *
 * ページ構造（年度別ページ）:
 *   - <a href="/uploaded/attachment/{ID}.pdf">{会議名}</a>
 *   - 1会議が複数 PDF に分割されている場合あり（例: （1）, （2）, （3））
 */

import {
  YEAR_PAGE_IDS,
  fetchPage,
  buildYearPageUrl,
  extractYearFromTitle,
  extractMonthFromTitle,
  estimateHeldOn,
  BASE_ORIGIN,
} from "./shared";

export interface TakamorivMeeting {
  /** 添付 ID (e.g., "123456") */
  attachmentId: string;
  /** 会議タイトル */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 年度別ページの URL (sourceUrl に使用) */
  yearPageUrl: string;
  /** 開催年 */
  year: number;
  /** 開催月（タイトルから取得、不明の場合は null） */
  month: number | null;
  /** 推定 heldOn YYYY-MM-DD（月のみ判明の場合は月初、不明なら null） */
  heldOn: string | null;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 */
export function parseYearPage(
  html: string,
  _year: number
): { attachmentId: string; title: string; pdfUrl: string }[] {
  const results: { attachmentId: string; title: string; pdfUrl: string }[] = [];
  const seen = new Set<string>();

  // /uploaded/attachment/{ID}.pdf のリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/uploaded\/attachment\/(\d+)\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const attachmentId = match[2]!;
    const rawTitle = match[3]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!attachmentId || !rawTitle) continue;
    if (seen.has(attachmentId)) continue;

    seen.add(attachmentId);

    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    results.push({ attachmentId, title: rawTitle, pdfUrl });
  }

  return results;
}

/**
 * 指定年の全会議録一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<TakamorivMeeting[]> {
  const pageId = YEAR_PAGE_IDS[year];
  if (!pageId) {
    console.warn(`[434281-takamori] 対応する年度別ページがありません: ${year}`);
    return [];
  }

  const yearPageUrl = buildYearPageUrl(pageId);
  const html = await fetchPage(yearPageUrl);
  if (!html) {
    console.warn(`[434281-takamori] 年度別ページの取得に失敗しました: ${yearPageUrl}`);
    return [];
  }

  const entries = parseYearPage(html, year);
  const meetings: TakamorivMeeting[] = [];

  for (const entry of entries) {
    const titleYear = extractYearFromTitle(entry.title);
    // タイトルに年が含まれる場合は一致確認
    if (titleYear !== null && titleYear !== year) continue;

    const month = extractMonthFromTitle(entry.title);
    const heldOn = month !== null ? estimateHeldOn(year, month) : null;

    meetings.push({
      attachmentId: entry.attachmentId,
      title: entry.title,
      pdfUrl: entry.pdfUrl,
      yearPageUrl: yearPageUrl,
      year,
      month,
      heldOn,
    });
  }

  return meetings;
}
