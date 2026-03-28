/**
 * 浜中町議会 — list フェーズ
 *
 * 固定の会議録ページから PDF リンクを抽出し、
 * 指定年の会議録だけを返す。
 */

import {
  buildDocumentUrl,
  buildListUrl,
  fetchPage,
  parseDateText,
} from "./shared";

export interface HamanakaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(linkHtml: string): string {
  return stripHtml(linkHtml)
    .replace(/\((?:\d+(?:\.\d+)?)\s*(?:KB|MB)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 一覧ページ HTML から PDF エントリを抽出する。
 */
export function parseListPage(html: string, pageUrl: string): HamanakaMeeting[] {
  const meetings: HamanakaMeeting[] = [];
  const seen = new Set<string>();
  let currentSection = "";

  const tokenPattern =
    /<(h2|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  for (const match of html.matchAll(tokenPattern)) {
    const tag = match[1]!;
    const attrs = match[2] ?? "";
    const innerHtml = match[3] ?? "";

    if (tag.toLowerCase() === "h2") {
      currentSection = stripHtml(innerHtml);
      continue;
    }

    const hrefMatch = attrs.match(/href="([^"]+)"/i);
    if (!hrefMatch) continue;

    if (!currentSection || !/定例会|臨時会/.test(currentSection)) continue;

    const href = hrefMatch[1]!;
    if (!/\.pdf(?:$|[?#])/i.test(href)) continue;

    const title = cleanTitle(innerHtml);
    const heldOn = parseDateText(title);
    if (!heldOn) continue;

    const pdfUrl = buildDocumentUrl(href, pageUrl);
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    meetings.push({
      pdfUrl,
      title,
      heldOn,
      section: currentSection,
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
): Promise<HamanakaMeeting[]> {
  const pageUrl = buildListUrl(baseUrl);
  const html = await fetchPage(pageUrl);
  if (!html) return [];

  return parseListPage(html, pageUrl).filter((meeting) =>
    meeting.heldOn.startsWith(`${year}-`),
  );
}
