import { fetchPage, resolveUrl, toJapaneseEra } from "./shared";

export interface AnpachiYearPage {
  label: string;
  url: string;
}

export interface AnpachiArticle {
  detailUrl: string;
  title: string;
  pageId: string;
}

export interface AnpachiMeeting {
  detailUrl: string;
  title: string;
  pageId: string;
  pdfUrl: string;
}

/** トップページから年度別ページを抽出する */
export function parseTopPage(html: string, baseUrl: string): AnpachiYearPage[] {
  const results: AnpachiYearPage[] = [];
  const linkRegex =
    /<a[^>]+href="([^"]*category\/9-3-\d+-0-0-0-0-0-0-0\.html)"[^>]*>\s*([^<]+?)\s*<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]?.trim();
    const label = match[2]?.trim();
    if (!href || !label) continue;
    if (!/(?:令和|平成).+年/.test(label)) continue;
    if (results.some((result) => result.label === label)) continue;
    results.push({ label, url: resolveUrl(baseUrl, href) });
  }

  return results;
}

/** 年度別ページから記事リンクを抽出する */
export function parseYearPage(html: string): AnpachiArticle[] {
  const results: AnpachiArticle[] = [];
  const linkRegex =
    /<li>\s*<a[^>]+href="([^"]*\/(\d{10})\.html)"[^>]*>\s*([^<]*会議録)\s*<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const detailUrl = match[1]?.trim();
    const pageId = match[2]?.trim();
    const title = match[3]?.trim();
    if (!detailUrl || !pageId || !title) continue;
    results.push({ detailUrl, title, pageId });
  }

  return results;
}

/** 記事ページから会議録 PDF を抽出する */
export function parseDetailPage(
  html: string,
  detailUrl: string,
): { pdfUrl: string; articleTitle: string | null } | null {
  const titleMatch = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  const articleTitle = titleMatch?.[1]?.trim() ?? null;

  const blockMatch = html.match(
    /<div[^>]*class="mol_attachfileblock[^"]*"[^>]*>[\s\S]*?<p[^>]*class="mol_attachfileblock_title"[^>]*>\s*会議録\s*<\/p>[\s\S]*?<a[^>]+href="([^"]+\.pdf)"[^>]*>/i,
  );
  if (!blockMatch?.[1]) return null;

  return {
    pdfUrl: resolveUrl(detailUrl, blockMatch[1]),
    articleTitle,
  };
}

/** 指定年度の会議録一覧を取得する */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<AnpachiMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const eraLabels = toJapaneseEra(year);
  const topPages = parseTopPage(topHtml, baseUrl);
  const yearPage = topPages.find((page) =>
    eraLabels.some((label) => page.label.includes(label)),
  );
  if (!yearPage) return [];

  const yearHtml = await fetchPage(yearPage.url);
  if (!yearHtml) return [];

  const articles = parseYearPage(yearHtml);
  const meetings: AnpachiMeeting[] = [];

  for (const article of articles) {
    const detailUrl = resolveUrl(yearPage.url, article.detailUrl);
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const detail = parseDetailPage(detailHtml, detailUrl);
    if (!detail) continue;

    meetings.push({
      detailUrl,
      title: detail.articleTitle ?? article.title,
      pageId: article.pageId,
      pdfUrl: detail.pdfUrl,
    });
  }

  return meetings;
}

export { parseJapaneseDate } from "./shared";
