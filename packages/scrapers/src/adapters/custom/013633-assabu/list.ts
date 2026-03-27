/**
 * 厚沢部町議会（北海道） — list フェーズ
 *
 * 議事録一覧トップ → 年別一覧 → 記事ページ → 「議事録本文」PDF を収集する。
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  buildDateString,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
} from "./shared";

export interface AssabuDocument {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  sourceUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  pageId: string;
}

interface YearPageLink {
  url: string;
  year: number | null;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function extractPageId(url: string): string {
  return url.match(/\/(\d+)\.html$/)?.[1] ?? url;
}

/**
 * トップ一覧から年度別ページ URL を抽出する。
 */
export function parseListPage(html: string): YearPageLink[] {
  const results: YearPageLink[] = [];
  const seen = new Set<string>();
  const regex =
    /<a\s[^>]*href="(\/site\/gikai\/list32-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const path = match[1];
    const linkText = stripTags(match[2] ?? "");
    if (!path || !linkText.includes("年")) continue;

    const url = `${BASE_ORIGIN}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({
      url,
      year: parseWarekiYear(linkText),
    });
  }

  return results;
}

/**
 * 年別ページから記事ページ URL を抽出する。
 */
export function parseYearPage(html: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const regex =
    /<a\s[^>]*href="(\/site\/gikai\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const path = match[1];
    const linkText = stripTags(match[2] ?? "");
    if (!path || !/会|委員会/.test(linkText)) continue;

    const url = `${BASE_ORIGIN}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    results.push(url);
  }

  return results;
}

/**
 * 記事ページから「議事録本文」PDF を抽出する。
 */
export function parseArticlePage(html: string, pageUrl: string): AssabuDocument[] {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = stripTags(titleMatch?.[1] ?? "");
  const year = parseWarekiYear(title);
  if (!title || !year) return [];

  const detailMatch = html.match(
    /<div class="detail_free"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const detailHtml = detailMatch?.[1] ?? "";
  if (!detailHtml) return [];

  const results: AssabuDocument[] = [];
  const sectionRegex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/gi;

  for (const sectionMatch of detailHtml.matchAll(sectionRegex)) {
    const heading = stripTags(sectionMatch[1] ?? "");
    const sectionHtml = sectionMatch[2] ?? "";
    const heldOn = buildDateString(year, heading);
    const pdfRegex =
      /<a\s[^>]*href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const pdfMatch of sectionHtml.matchAll(pdfRegex)) {
      const href = pdfMatch[1];
      const linkText = stripTags(pdfMatch[2] ?? "");
      if (!href || !linkText.includes("議事録本文")) continue;

      results.push({
        title: `${title} ${heading}`,
        heldOn,
        pdfUrl: `${BASE_ORIGIN}${href}`,
        sourceUrl: pageUrl,
        meetingType: detectMeetingType(title),
        pageId: extractPageId(pageUrl),
      });
    }
  }

  return results;
}

export async function fetchDocumentList(year: number): Promise<AssabuDocument[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const yearPages = parseListPage(listHtml).filter((page) => page.year === year);
  const documents: AssabuDocument[] = [];

  for (const yearPage of yearPages) {
    const yearHtml = await fetchPage(yearPage.url);
    if (!yearHtml) continue;

    const articleUrls = parseYearPage(yearHtml);
    for (const articleUrl of articleUrls) {
      const articleHtml = await fetchPage(articleUrl);
      if (!articleHtml) continue;

      for (const doc of parseArticlePage(articleHtml, articleUrl)) {
        if (doc.heldOn?.startsWith(`${year}-`)) {
          documents.push(doc);
        }
      }
    }
  }

  return documents;
}
