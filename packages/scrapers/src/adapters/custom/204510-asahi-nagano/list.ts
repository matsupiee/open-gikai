/**
 * 朝日村議会 -- list フェーズ
 *
 * 2 階層構造:
 *   会議録一覧 (/official/.../giketsu_kaigiroku/1/index.html)
 *     └─ 年別ページ (.../4516.html)
 *          └─ PDF ファイル (/material/files/group/2/*.pdf)
 */

import { BASE_ORIGIN, LIST_URL, detectMeetingType, fetchPage, parseWarekiYear } from "./shared";

export interface AsahiNaganoYearPage {
  title: string;
  year: number;
  yearPageUrl: string;
  pageId: string;
}

export interface AsahiNaganoPdfRecord {
  title: string;
  year: number;
  pdfUrl: string;
  meetingType: string;
  yearPageUrl: string;
  sessionKey: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return href.startsWith("/") ? `${BASE_ORIGIN}${href}` : `${BASE_ORIGIN}/${href}`;
}

function extractPageId(url: string): string | null {
  return url.match(/\/(\d+)\.html$/)?.[1] ?? null;
}

/**
 * 一覧ページ HTML から年別ページを抽出する。
 */
export function parseYearPageLinks(html: string): AsahiNaganoYearPage[] {
  const pages: AsahiNaganoYearPage[] = [];
  const pattern = /<a\s+href="([^"]*\/giketsu_kaigiroku\/1\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const yearPageUrl = toAbsoluteUrl(match[1]!);
    const title = stripTags(match[2]!);
    const year = parseWarekiYear(title);
    const pageId = extractPageId(yearPageUrl);
    if (!year || !pageId) continue;

    if (pages.some((page) => page.yearPageUrl === yearPageUrl)) continue;

    pages.push({
      title,
      year,
      yearPageUrl,
      pageId,
    });
  }

  return pages;
}

function cleanPdfTitle(text: string): string {
  return text.replace(/\s*\(PDFファイル:[^)]+\)\s*$/u, "").replace(/\s+/g, "");
}

/**
 * 年別ページ HTML から PDF レコードを抽出する。
 */
export function parseYearPage(html: string, page: AsahiNaganoYearPage): AsahiNaganoPdfRecord[] {
  const records: AsahiNaganoPdfRecord[] = [];
  const pattern = /<a\s+class="pdf"[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let index = 0;
  for (const match of html.matchAll(pattern)) {
    const pdfUrl = toAbsoluteUrl(match[1]!);
    const title = cleanPdfTitle(stripTags(match[2]!));
    if (!title.includes("会議録")) continue;

    records.push({
      title,
      year: page.year,
      pdfUrl,
      meetingType: detectMeetingType(title),
      yearPageUrl: page.yearPageUrl,
      sessionKey: `asahi_nagano_${page.pageId}_${index}`,
    });
    index++;
  }

  return records;
}

/**
 * 指定年の PDF レコード一覧を返す。
 */
export async function fetchPdfList(year: number): Promise<AsahiNaganoPdfRecord[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const yearPages = parseYearPageLinks(listHtml).filter((page) => page.year === year);
  const records: AsahiNaganoPdfRecord[] = [];

  for (const page of yearPages) {
    const yearHtml = await fetchPage(page.yearPageUrl);
    if (!yearHtml) continue;
    records.push(...parseYearPage(yearHtml, page));
  }

  return records;
}
