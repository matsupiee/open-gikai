/**
 * 日高町議会（和歌山県） — list フェーズ
 *
 * 議会だより一覧ページから PDF リンクを収集する。
 * 一覧ページは年度ごとに 4月 / 7月 / 10月 / 1月 の号を持つテーブル構造。
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  convertJapaneseEra,
  fetchPage,
  normalizeFullWidthDigits,
} from "./shared";

export interface HidakaWakayamaMeeting {
  pdfUrl: string;
  title: string;
  issueNumber: number;
  /** 実際の会議開催年（一覧取得の year フィルタに使用） */
  meetingYear: number;
  /** PDF 公開年 */
  publishYear: number;
  /** PDF 公開月 */
  publishMonth: number;
}

export function parseIssueNumber(text: string): number | null {
  const normalized = normalizeFullWidthDigits(text);
  const match = normalized.match(/第\s*(\d+)\s*号/);
  if (!match) return null;
  return Number(match[1]);
}

export function parseFiscalYear(text: string): number | null {
  const normalized = normalizeFullWidthDigits(text);

  const reiwaMatch = normalized.match(/令和\s*(元|\d+)\s*(?:\))?\s*年度/);
  if (reiwaMatch) {
    return convertJapaneseEra("令和", reiwaMatch[1]!);
  }

  const heiseiMatch = normalized.match(/平成\s*(元|\d+)\s*(?:\))?\s*年度/);
  if (heiseiMatch) {
    return convertJapaneseEra("平成", heiseiMatch[1]!);
  }

  return null;
}

function resolveUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  return new URL(href, LIST_PAGE_URL).toString();
}

export function parseListPage(html: string): HidakaWakayamaMeeting[] {
  const results: HidakaWakayamaMeeting[] = [];
  const sectionPattern = /<h2[^>]*>([\s\S]*?)<\/h2>\s*<table[^>]*>([\s\S]*?)<\/table>/gi;

  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const headingText = sectionMatch[1]!.replace(/<[^>]+>/g, "").trim();
    const fiscalYear = parseFiscalYear(headingText);
    if (!fiscalYear) continue;

    const tableHtml = sectionMatch[2]!;
    const months = [...tableHtml.matchAll(/<th[^>]*>\s*([０-９0-9]+)月\s*<\/th>/gi)].map((m) =>
      Number(normalizeFullWidthDigits(m[1]!)),
    );
    const cells = [...tableHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);

    for (let index = 0; index < Math.min(months.length, cells.length); index++) {
      const month = months[index]!;
      const cellHtml = cells[index]!;
      const linkMatch = cellHtml.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const issueText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();
      const issueNumber = parseIssueNumber(issueText);
      if (!issueNumber) continue;

      results.push({
        pdfUrl: resolveUrl(linkMatch[1]!),
        title: `日高町議会だより 第${issueNumber}号`,
        issueNumber,
        meetingYear: fiscalYear,
        publishYear: month === 1 ? fiscalYear + 1 : fiscalYear,
        publishMonth: month,
      });
    }
  }

  return results;
}

export async function fetchMeetingList(year: number): Promise<HidakaWakayamaMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  return parseListPage(html).filter((meeting) => meeting.meetingYear === year);
}
