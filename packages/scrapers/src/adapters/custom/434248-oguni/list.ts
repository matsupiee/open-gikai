/**
 * 小国町議会 — list フェーズ
 *
 * 会議録一覧ページ（/23582）から年度別に PDF リンクを収集する。
 *
 * ページ構造:
 * - <h3>令和８年</h3>  → 年度情報
 * - <ul><li><a href="/resource.php?e={ハッシュ}">タイトル (261KB)</a></li></ul>
 *
 * 一覧ページに全 PDF が集約されているため、年度フィルタリングは
 * h3 タグから取得した西暦年と fetchList の引数 year を照合する。
 */

import { BASE_ORIGIN, LIST_PAGE_URL, fetchPage, parseJapaneseYear } from "./shared";

export interface OguniMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議のタイトル（ファイルサイズ表記を除去済み） */
  title: string;
  /** h3 タグから取得した西暦年 */
  year: number;
}

/**
 * リンクテキストからタイトルを抽出する（ファイルサイズ表記を除去）。
 * e.g., "令和8年第1回臨時会 (261KB)" → "令和8年第1回臨時会"
 * e.g., "第4回定例会 (1,470KB)" → "第4回定例会"
 */
export function cleanTitle(linkText: string): string {
  return linkText
    .replace(/\s*\([\d,]+KB\)\s*$/i, "")
    .trim();
}

/**
 * 一覧ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * @param html 一覧ページの HTML
 * @param year フィルタリングする西暦年（null の場合は全件返す）
 */
export function parseListPage(html: string, year: number | null = null): OguniMeeting[] {
  const results: OguniMeeting[] = [];

  let currentYear: number | null = null;

  // h3 タグと resource.php リンクを順番に処理する
  // Cheerio を模倣して正規表現で順序を維持しながら処理
  const elementPattern = /<h3[^>]*>([\s\S]*?)<\/h3>|<a[^>]+href="(\/resource\.php\?e=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(elementPattern)) {
    if (match[1] !== undefined) {
      // h3 タグ: 年度情報を更新
      const headingText = match[1].replace(/<[^>]+>/g, "").trim();
      const parsedYear = parseJapaneseYear(headingText);
      if (parsedYear !== null) {
        currentYear = parsedYear;
      }
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // a タグ: PDF リンク
      if (currentYear === null) continue;
      if (year !== null && currentYear !== year) continue;

      const href = match[2];
      const linkText = match[3].replace(/<[^>]+>/g, "").trim();
      const title = cleanTitle(linkText);
      if (!title) continue;

      const pdfUrl = `${BASE_ORIGIN}${href}`;

      results.push({
        pdfUrl,
        title,
        year: currentYear,
      });
    }
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<OguniMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  return parseListPage(html, year);
}
