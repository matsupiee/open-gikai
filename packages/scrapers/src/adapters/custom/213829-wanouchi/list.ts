/**
 * 輪之内町議会 — list フェーズ
 *
 * 年度別ページから会議録 PDF リンクを収集する。
 *
 * HTML 構造:
 *   <a href="https://town.wanouchi.gifu.jp/wp-content/uploads/gikai250303.pdf">...</a>
 *
 * PDF ファイル名規則:
 *   gikai{年号2桁}{月2桁}{日2桁}.pdf
 *   例: gikai250303.pdf → 令和7年3月3日
 */

import { BASE_ORIGIN, YEAR_PAGE_MAP, fetchPage } from "./shared";

export interface WanouchiMeeting {
  pdfUrl: string;
  /** PDF ファイル名から取得した識別子（例: "250303"） */
  fileCode: string;
}

/**
 * 年度別ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parseYearPage(html: string): WanouchiMeeting[] {
  const results: WanouchiMeeting[] = [];
  const seen = new Set<string>();

  // href 属性から gikai*.pdf パターンのリンクを抽出（-N サフィックスも許容）
  const linkRegex = /href="([^"]*wp-content\/uploads\/gikai(\d+)(?:-\d+)?\.pdf)"/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const fileCode = match[2]!;

    if (seen.has(fileCode)) continue;
    seen.add(fileCode);

    // 絶対 URL に変換
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    results.push({ pdfUrl, fileCode });
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<WanouchiMeeting[]> {
  const yearPageUrl = YEAR_PAGE_MAP[year];
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html);
}
