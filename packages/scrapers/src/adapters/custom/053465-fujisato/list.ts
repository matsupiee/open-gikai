/**
 * 藤里町議会 -- list フェーズ
 *
 * 2023年以降:
 * - トップページの「定例会・臨時会」一覧から「会議結果について」記事を取得
 * - 各記事から PDF と会期開始日を抽出
 *
 * 2021-2022年:
 * - 「議会会議結果一覧」ページから PDF と会期開始日を抽出
 */

import {
  ARCHIVE_PAGE_URL,
  BASE_ORIGIN,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toHalfWidth,
} from "./shared";

export interface FujisatoMeeting {
  title: string;
  pdfUrl: string;
  heldOn: string;
  meetingType: string;
  year: number;
}

export interface RecentArticleLink {
  title: string;
  articleUrl: string;
  year: number;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${BASE_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

function buildHeldOn(year: number, monthText: string, dayText: string): string {
  const month = Number(toHalfWidth(monthText));
  const day = Number(toHalfWidth(dayText));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * トップページから「会議結果について」記事へのリンクを抽出する。
 */
export function parseTopPage(html: string): RecentArticleLink[] {
  const results: RecentArticleLink[] = [];
  const seen = new Set<string>();
  const linkPattern =
    /<a[^>]+href="(\/town\/c613\/teireirinji\/\d+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const articleUrl = resolveUrl(match[1]!);
    const title = stripTags(match[2]!);

    if (!title.includes("会議結果について")) continue;
    if (seen.has(articleUrl)) continue;

    const year = parseWarekiYear(title);
    if (!year) continue;

    seen.add(articleUrl);
    results.push({ title, articleUrl, year });
  }

  return results;
}

/**
 * 個別記事ページから PDF と開催日を抽出する。
 */
export function parseRecentArticlePage(
  html: string,
  _articleUrl: string,
): FujisatoMeeting | null {
  const titleMatch = html.match(/<h1>([^<]+)<\/h1>/i);
  const rawTitle = titleMatch?.[1]?.trim();
  if (!rawTitle) return null;

  const title = rawTitle.replace(/について$/, "");
  const year = parseWarekiYear(title);
  if (!year) return null;

  const contentMatch = html.match(
    /<!-- free_content -->([\s\S]*?)<!-- \/free_content -->/i,
  );
  const contentHtml = contentMatch?.[1] ?? html;

  const pdfMatch = contentHtml.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>/i);
  if (!pdfMatch?.[1]) return null;

  const text = stripTags(contentHtml);
  const dateMatch = toHalfWidth(text).match(
    /(?:が|会期：)\s*(\d{1,2})月(\d{1,2})日/,
  );
  if (!dateMatch) return null;

  return {
    title,
    pdfUrl: resolveUrl(pdfMatch[1]),
    heldOn: buildHeldOn(year, dateMatch[1]!, dateMatch[2]!),
    meetingType: detectMeetingType(title),
    year,
  };
}

/**
 * 旧まとめページから PDF 一覧を抽出する。
 */
export function parseArchivePage(html: string): FujisatoMeeting[] {
  const results: FujisatoMeeting[] = [];
  const yearSectionPattern =
    /◆\s*(令和|平成)(元|[０-９\d]+)年([\s\S]*?)(?=◆\s*(?:令和|平成)(?:元|[０-９\d]+)年|<!-- \/free_content -->|$)/g;

  for (const sectionMatch of html.matchAll(yearSectionPattern)) {
    const era = sectionMatch[1]!;
    const eraYearText = sectionMatch[2]!;
    const sectionHtml = sectionMatch[3]!;
    const yearLabel = `${era}${eraYearText}年`;
    const year = parseWarekiYear(yearLabel);
    if (!year) continue;

    const entryPattern =
      /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?会期：\s*([０-９\d]{1,2})月([０-９\d]{1,2})日/gi;

    for (const entryMatch of sectionHtml.matchAll(entryPattern)) {
      const linkText = stripTags(entryMatch[2]!);
      const title = linkText.includes("会議結果")
        ? `${yearLabel}${linkText}`
        : `${yearLabel}${linkText}会議結果`;

      results.push({
        title,
        pdfUrl: resolveUrl(entryMatch[1]!),
        heldOn: buildHeldOn(year, entryMatch[3]!, entryMatch[4]!),
        meetingType: detectMeetingType(linkText),
        year,
      });
    }
  }

  return results;
}

/**
 * 指定年の会議結果 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<FujisatoMeeting[]> {
  const meetings: FujisatoMeeting[] = [];
  const seen = new Set<string>();

  const topHtml = await fetchPage(baseUrl);
  if (topHtml) {
    const recentArticles = parseTopPage(topHtml).filter((article) => article.year === year);

    for (const article of recentArticles) {
      const articleHtml = await fetchPage(article.articleUrl);
      if (!articleHtml) continue;

      const meeting = parseRecentArticlePage(articleHtml, article.articleUrl);
      if (!meeting || seen.has(meeting.pdfUrl)) continue;

      seen.add(meeting.pdfUrl);
      meetings.push(meeting);
    }
  }

  if (year <= 2022) {
    const archiveHtml = await fetchPage(ARCHIVE_PAGE_URL);
    if (archiveHtml) {
      for (const meeting of parseArchivePage(archiveHtml)) {
        if (meeting.year !== year || seen.has(meeting.pdfUrl)) continue;
        seen.add(meeting.pdfUrl);
        meetings.push(meeting);
      }
    }
  }

  return meetings;
}
