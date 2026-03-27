/**
 * 笛吹市議会 — list フェーズ
 *
 * トップページから年度別ページを収集し、対象年のページから PDF リンクを抽出する。
 *
 * HTML 構造:
 * - トップページの <li><a href="/gikai/shisejoho/shigikai/gijiroku/{year}.html">
 * - 年度別ページの <h2> 見出しごとに <p><a href="/documents/...pdf" class="icon_pdf">
 */

import { BASE_ORIGIN, detectMeetingType, fetchPage } from "./shared";

export interface FuefukiMeeting {
  pdfUrl: string;
  title: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(text: string): string {
  return decodeHtml(stripTags(text)).replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(href: string, baseUrl = BASE_ORIGIN): string {
  return new URL(href, baseUrl).toString();
}

export function parseTopPage(html: string, baseUrl = BASE_ORIGIN): string[] {
  const urls: string[] = [];
  const linkRegex =
    /<a\s[^>]*href="([^"]*\/gikai\/shisejoho\/shigikai\/gijiroku\/\d{4}\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]?.trim();
    if (!href) continue;
    const url = toAbsoluteUrl(href, baseUrl);
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

export function parseYearPage(html: string): FuefukiMeeting[] {
  const meetings: FuefukiMeeting[] = [];
  const sectionRegex =
    /<h2[^>]*>([\s\S]*?)<\/h2>\s*<p[^>]*>\s*<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(sectionRegex)) {
    const heading = cleanText(match[1] ?? "");
    const href = match[2]?.trim();
    const linkText = cleanText(match[3] ?? "");
    if (!href || !linkText) continue;

    const title = linkText.replace(/\s*[（(]PDF[:：].*?[）)]\s*$/, "").trim();
    if (!title) continue;

    meetings.push({
      pdfUrl: toAbsoluteUrl(href),
      title,
      meetingType: detectMeetingType(title || heading),
    });
  }

  return meetings;
}

export async function fetchMeetingList(baseUrl: string, year: number): Promise<FuefukiMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseTopPage(topHtml, baseUrl);
  const targetUrl = yearPageUrls.find((url) => {
    const pathname = new URL(url).pathname;
    return pathname.endsWith(`/${year}.html`);
  });
  if (!targetUrl) return [];

  const yearHtml = await fetchPage(targetUrl);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml);
}
