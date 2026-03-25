/**
 * 錦町議会 会議録 — list フェーズ
 *
 * 一覧ページ（list00253.html）から年度別ページへのリンクを収集し、
 * 各年度ページから PDF リンクと会議メタ情報を取得する。
 *
 * 構造:
 *   一覧ページ (list00253.html)
 *   └── <a href="kiji{記事ID}/index.html">錦町議会会議録（定例会・臨時会）</a>
 *
 *   年度別ページ (kiji{記事ID}/index.html)
 *   └── <a href="kiji{記事ID}/3_{記事ID}_{ファイルID}_up_{ハッシュ}.pdf">
 *         令和6年第1回議会定例会（3月5日～3月12日）
 *       </a>
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  buildExternalId,
  buildYearPageUrl,
  extractFileId,
  extractYearFromTitle,
  fetchPage,
  parseJapaneseDate,
} from "./shared";

export interface NishikiMeeting {
  /** 年度ページの kiji 番号 (e.g., "003905") */
  kijiId: string;
  /** 会議タイトル (e.g., "令和6年第1回議会定例会（3月5日～3月12日）") */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 外部 ID */
  externalId: string;
}

/**
 * 一覧ページ HTML から年度別ページの kiji 番号を抽出する。
 * 返り値: kijiId[]
 */
export function parseListPage(html: string): string[] {
  const kijiIds: string[] = [];

  // kiji{ID}/index.html 形式のリンクを抽出
  const linkRegex = /href=["'][^"']*\/kiji(\d+)\/index\.html["']/gi;

  for (const match of html.matchAll(linkRegex)) {
    const kijiId = match[1];
    if (!kijiId) continue;

    if (!kijiIds.includes(kijiId)) {
      kijiIds.push(kijiId);
    }
  }

  return kijiIds;
}

/**
 * 年度別ページ HTML から PDF リンクと会議メタ情報を抽出する。
 */
export function parseYearPage(
  html: string,
  _kijiId: string,
  year: number
): { title: string; pdfUrl: string; heldOn: string | null }[] {
  const results: { title: string; pdfUrl: string; heldOn: string | null }[] = [];

  // PDF リンクとリンクテキストを抽出
  const pdfLinkRegex =
    /<a\s+[^>]*href=["']([^"']*\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfLinkRegex)) {
    const href = match[1];
    const rawTitle = match[2]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!href || !rawTitle) continue;

    // 絶対 URL に正規化
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // リンクテキストから開催日を抽出（年情報がない場合は年フィルタの year を使用）
    const titleYear = extractYearFromTitle(rawTitle);
    const heldOn = parseJapaneseDate(rawTitle, titleYear ?? year);

    results.push({ title: rawTitle, pdfUrl, heldOn });
  }

  return results;
}

/**
 * 指定年の全会議録一覧を取得する。
 * 年フィルタリング: 年度別ページのタイトルから西暦年を抽出して対象年と照合する。
 */
export async function fetchMeetingList(year: number): Promise<NishikiMeeting[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const kijiIds = parseListPage(listHtml);

  const meetings: NishikiMeeting[] = [];

  for (const kijiId of kijiIds) {
    const yearPageUrl = buildYearPageUrl(kijiId);
    const yearPageHtml = await fetchPage(yearPageUrl);
    if (!yearPageHtml) continue;

    const pdfs = parseYearPage(yearPageHtml, kijiId, year);

    for (const pdf of pdfs) {
      // タイトルから年を抽出してフィルタリング
      const titleYear = extractYearFromTitle(pdf.title);
      // タイトルに年情報がない場合はすべて対象
      if (titleYear !== null && titleYear !== year) continue;

      if (!pdf.heldOn) continue;

      const fileId = extractFileId(pdf.pdfUrl);

      meetings.push({
        kijiId,
        title: pdf.title,
        pdfUrl: pdf.pdfUrl,
        heldOn: pdf.heldOn,
        externalId: buildExternalId(kijiId, fileId),
      });
    }
  }

  return meetings;
}
