/**
 * 穴水町議会 — list フェーズ
 *
 * 現行ページは年度別の表、バックナンバーページは <h3> 年度見出し + PDF リンク群
 * という 2 種類の HTML 構造を持つ。
 */

import {
  buildBacknumberUrl,
  eraToYear,
  fetchPage,
  normalizePdfUrl,
  stripHtml,
} from "./shared";

export interface AnamizuMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  year: number;
}

/** リンクテキストからファイルサイズ表記を除去する */
export function cleanTitle(linkText: string): string {
  return stripHtml(linkText)
    .replace(/\s*\[\s*\[?PDFファイル[^\]]*\]/g, "")
    .trim();
}

/**
 * タイトル内の月情報から開催日を推定する。
 * 月のみ分かる場合は YYYY-MM-01 を返す。
 */
export function parseDateFromTitle(
  title: string,
  year: number
): string | null {
  const match = title.match(/第\d+回(\d+)月(?:定例|臨時)?会/);
  if (!match) return null;

  const month = String(parseInt(match[1]!, 10)).padStart(2, "0");
  return `${year}-${month}-01`;
}

/**
 * 現行ページの年度別テーブルをパースする。
 */
export function parseCurrentListPage(
  html: string,
  targetYear?: number
): AnamizuMeeting[] {
  const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];

  const rowMatches = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rowMatches.length === 0) return [];

  const headerYears = [
    ...rowMatches[0]![1]!.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi),
  ].map((match) => eraToYear(stripHtml(match[1]!)));

  const results: AnamizuMeeting[] = [];

  for (const row of rowMatches.slice(1)) {
    const cells = [...row[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];

    for (let i = 0; i < cells.length; i++) {
      const year = headerYears[i];
      if (!year) continue;
      if (targetYear && year !== targetYear) continue;

      const cellHtml = cells[i]![1]!;
      const linkMatches = [
        ...cellHtml.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi),
      ];

      for (const link of linkMatches) {
        const title = cleanTitle(link[2]!);
        if (!title) continue;

        results.push({
          pdfUrl: normalizePdfUrl(link[1]!),
          title,
          heldOn: parseDateFromTitle(title, year),
          year,
        });
      }
    }
  }

  return results;
}

/**
 * バックナンバーページの <h3> 年度セクションをパースする。
 */
export function parseBacknumberPage(
  html: string,
  targetYear?: number
): AnamizuMeeting[] {
  const results: AnamizuMeeting[] = [];

  const sectionPattern = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;
  for (const match of html.matchAll(sectionPattern)) {
    const yearLabel = stripHtml(match[1]!);
    const year = eraToYear(yearLabel);
    if (!year) continue;
    if (targetYear && year !== targetYear) continue;

    const sectionHtml = match[2]!;
    const links = [
      ...sectionHtml.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi),
    ];

    for (const link of links) {
      const title = cleanTitle(link[2]!);
      if (!title) continue;

      results.push({
        pdfUrl: normalizePdfUrl(link[1]!),
        title,
        heldOn: parseDateFromTitle(title, year),
        year,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<AnamizuMeeting[]> {
  const currentHtml = await fetchPage(baseUrl);
  const currentMeetings = currentHtml ? parseCurrentListPage(currentHtml, year) : [];

  if (currentMeetings.length > 0 || year >= 2022) {
    return currentMeetings;
  }

  const backnumberHtml = await fetchPage(buildBacknumberUrl());
  if (!backnumberHtml) return currentMeetings;

  return parseBacknumberPage(backnumberHtml, year);
}
