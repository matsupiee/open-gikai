/**
 * 神戸町議会 — list フェーズ
 *
 * 1ページ（gikai08.html）に全年度の PDF リンクが掲載されている。
 * 年度コード（r6, r7 等）でフィルタリングし、対象年の PDF を返す。
 *
 * HTML 構造:
 *   <a href="pdf/kaigiroku/r6_1.pdf">第1回定例会（3月）</a>
 *   <a href="pdf/kaigiroku/r7_2.pdf">第2回臨時会（4月）</a>
 */

import { BASE_ORIGIN, LIST_PATH, PDF_BASE, fetchPage, toEraCode } from "./shared";

export interface GodoMeeting {
  pdfUrl: string;
  title: string;
  eraCode: string;
  number: string;
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * @param html - gikai08.html の HTML
 * @param targetEraCode - フィルタリングする年度コード（例: "r6"）、null なら全件
 */
export function parseListPage(
  html: string,
  targetEraCode: string | null
): GodoMeeting[] {
  const results: GodoMeeting[] = [];

  // <a href="pdf/kaigiroku/{eraCode}_{number}.pdf">テキスト</a> を抽出
  const linkRegex =
    /<a[^>]+href="([^"]*pdf\/kaigiroku\/([^"]+?)_(\d+)\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const eraCode = match[2]!;
    const number = match[3]!;
    const linkText = match[4]!.replace(/<[^>]+>/g, "").trim();

    // 年度コードでフィルタリング
    if (targetEraCode && eraCode !== targetEraCode) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${PDF_BASE}${href}`;
    }

    results.push({
      pdfUrl,
      title: linkText,
      eraCode,
      number,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<GodoMeeting[]> {
  const listUrl = baseUrl || `${BASE_ORIGIN}${LIST_PATH}`;
  const html = await fetchPage(listUrl);
  if (!html) return [];

  const eraCode = toEraCode(year);
  if (!eraCode) return [];

  return parseListPage(html, eraCode);
}
