/**
 * 井川町議会 — list フェーズ
 *
 * 議会だより一覧ページ（1305.html）から PDF リンクとタイトルを収集する。
 * ページネーションなし。単一ページに全号のリンクが掲載されている。
 *
 * リンクテキスト例:
 *   いかわ町議会だより（令和7年6月議会）
 *   いかわ町議会だより（令和7年3月議会）
 *   いかわ町議会だより（平成28年3月議会）
 */

import { BASE_ORIGIN, LIST_URL, convertJapaneseEra, fetchPage } from "./shared";

export interface IkawaMeeting {
  pdfUrl: string;
  title: string;
  /** 会議の年: YYYY */
  year: number;
  /** 会議の月: 1-12 */
  month: number;
}

/**
 * リンクテキストから年月を抽出する。
 * 例: "いかわ町議会だより（令和7年6月議会）" → { year: 2025, month: 6 }
 */
export function parseMeetingYearMonth(
  text: string,
): { year: number; month: number } | null {
  const match = text.match(/(令和|平成|昭和)(元|\d+)年(\d+)月議会/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const month = parseInt(match[3]!, 10);

  const year = convertJapaneseEra(era, eraYearStr);
  if (!year) return null;

  return { year, month };
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する。
 * `/uploaded/attachment/{ID}.pdf` 形式のリンクのみ対象とする。
 */
export function parseListPage(html: string): IkawaMeeting[] {
  const results: IkawaMeeting[] = [];

  // <a href="...pdf">タイトル</a> パターンを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawTitle = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!rawTitle) continue;

    // 年月を抽出
    const yearMonth = parseMeetingYearMonth(rawTitle);
    if (!yearMonth) continue;

    // PDF の完全 URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({
      pdfUrl,
      title: rawTitle.trim(),
      year: yearMonth.year,
      month: yearMonth.month,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンク一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<IkawaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);
  return allMeetings.filter((m) => m.year === year);
}
