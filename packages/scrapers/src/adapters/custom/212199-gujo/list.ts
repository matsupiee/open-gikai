/**
 * 郡上市議会 — list フェーズ
 *
 * 一覧トップから対象年度の詳細ページを特定し、年度ページ内の PDF リンクを収集する。
 *
 * HTML 構造:
 *   トップページ:
 *     <a href="/admin/detail/11664.html">令和6年郡上市議会会議録</a>
 *   年度ページ:
 *     <p>令和６年第1回郡上市議会定例会</p>
 *     <p><a href="/admin/docs/....pdf">第１日目 ２月２０日</a></p>
 */

import {
  buildDocumentUrl,
  buildListUrl,
  buildYearPageTitles,
  collapseWhitespace,
  detectMeetingType,
  extractWesternYear,
  fetchPage,
  stripTags,
} from "./shared";

export interface GujoMeeting {
  title: string;
  sessionTitle: string;
  pdfUrl: string;
  heldOn: string;
  meetingType: "plenary" | "committee" | "extraordinary";
}

export function parseIndexPage(html: string, year: number): string[] {
  const targetTitles = new Set(buildYearPageTitles(year));
  const urls: string[] = [];

  const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1]!;
    const text = collapseWhitespace(stripTags(match[2]!));
    if (!targetTitles.has(text)) continue;

    const url = buildDocumentUrl(href);
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

function isSessionTitle(text: string): boolean {
  return /(令和|平成).*(定例会|臨時会|委員会)/.test(text);
}

function shouldSkipPdfLink(text: string): boolean {
  return /(議員別採択|議員別採決|採択結果|採決結果)/.test(text);
}

export function extractHeldOn(sessionTitle: string, linkText: string): string | null {
  const year = extractWesternYear(sessionTitle);
  if (!year) return null;

  const match = collapseWhitespace(linkText).match(/(\d+)月\s*(\d+)日/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!month || !day) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseYearPage(html: string): GujoMeeting[] {
  const meetings: GujoMeeting[] = [];
  let currentSessionTitle: string | null = null;

  const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of html.matchAll(paragraphPattern)) {
    const paragraphHtml = match[1]!;
    const text = collapseWhitespace(stripTags(paragraphHtml));
    if (!text) continue;

    const pdfMatch = paragraphHtml.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!pdfMatch) {
      if (isSessionTitle(text)) {
        currentSessionTitle = text;
      }
      continue;
    }

    if (!currentSessionTitle) continue;

    const linkText = collapseWhitespace(stripTags(pdfMatch[2]!));
    if (!linkText || shouldSkipPdfLink(linkText)) continue;

    const heldOn = extractHeldOn(currentSessionTitle, linkText);
    if (!heldOn) continue;

    meetings.push({
      title: `${currentSessionTitle} ${linkText}`,
      sessionTitle: currentSessionTitle,
      pdfUrl: buildDocumentUrl(pdfMatch[1]!),
      heldOn,
      meetingType: detectMeetingType(currentSessionTitle),
    });
  }

  return meetings;
}

export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<GujoMeeting[]> {
  const indexUrl = buildListUrl(baseUrl);
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexPage(indexHtml, year);
  if (yearPageUrls.length === 0) return [];

  const meetings: GujoMeeting[] = [];
  for (const yearPageUrl of yearPageUrls) {
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;
    meetings.push(...parseYearPage(yearHtml));
  }

  return meetings
    .filter((meeting, index, all) => all.findIndex((m) => m.pdfUrl === meeting.pdfUrl) === index)
    .sort((a, b) => a.heldOn.localeCompare(b.heldOn));
}
