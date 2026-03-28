/**
 * 普代村議会 — list フェーズ
 *
 * 固定の議事録ページから PDF リンクを抽出し、
 * 開催日で対象年の会議録だけを返す。
 */

import {
  buildDocumentUrl,
  buildListUrl,
  fetchPage,
  parseDateText,
} from "./shared";

export interface FudaiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
}

function cleanTitle(linkText: string): string {
  return linkText
    .replace(/\.pdf\b/gi, "")
    .replace(/\(\s*PDF[^)]*\)/gi, "")
    .replace(/（\s*PDF[^）]*）/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 一覧ページ HTML から PDF エントリを抽出する（テスト可能な純粋関数）。
 */
export function parseListPage(html: string, pageUrl: string): FudaiMeeting[] {
  const meetings: FudaiMeeting[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = stripHtml(match[2]!);
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    const pdfUrl = buildDocumentUrl(href, pageUrl);
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    meetings.push({
      pdfUrl,
      title: cleanTitle(linkText),
      heldOn,
    });
  }

  return meetings;
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<FudaiMeeting[]> {
  const pageUrl = buildListUrl(baseUrl);
  const html = await fetchPage(pageUrl);
  if (!html) return [];

  return parseListPage(html, pageUrl).filter((meeting) =>
    meeting.heldOn.startsWith(`${year}-`),
  );
}
