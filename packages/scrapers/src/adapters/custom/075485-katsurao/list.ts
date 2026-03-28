/**
 * 葛尾村議会 -- list フェーズ
 *
 * サイトトップと新着情報一覧 (`index-2.html`, `index-3.html`, ...)
 * を順にたどり、会議結果ページの URL を収集する。
 *
 * 各会議結果ページは HTML テーブルで議決一覧を公開しており、
 * PDF 会議録は提供されていない。
 */

import {
  BASE_ORIGIN,
  DEFAULT_BASE_URL,
  fetchPage,
  parseWarekiYear,
} from "./shared";

export interface KatsuraoMeetingRef {
  /** 会議結果ページ URL */
  pageUrl: string;
  /** 記事タイトル */
  articleTitle: string;
  /** 開催年 */
  year: number;
}

const MAX_LIST_PAGES = 10;

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  const normalized = trimmed || DEFAULT_BASE_URL;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

/**
 * 一覧ページ URL を構築する。
 * page=1 はトップページ、page>=2 は index-{n}.html。
 */
export function buildListPageUrl(baseUrl: string, page: number): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (page <= 1) return `${normalized}/`;
  return `${normalized}/index-${page}.html`;
}

/**
 * 一覧ページ HTML から会議結果ページを抽出する。
 */
export function parseListPage(html: string): KatsuraoMeetingRef[] {
  const refs: KatsuraoMeetingRef[] = [];
  const seen = new Set<string>();

  const linkPattern =
    /<a\s[^>]*href="([^"]*\/site\/gikai\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1]!;
    const articleTitle = match[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    if (!articleTitle.includes("結果について")) continue;

    const year = parseWarekiYear(articleTitle);
    if (!year) continue;

    const pageUrl = new URL(href, BASE_ORIGIN).toString();
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);

    refs.push({
      pageUrl,
      articleTitle,
      year,
    });
  }

  return refs;
}

function hasNextListPage(html: string, page: number): boolean {
  return html.includes(`index-${page + 1}.html`);
}

/**
 * 指定年の会議結果ページ一覧を取得する。
 */
export async function fetchMeetingRefs(
  baseUrl: string,
  year: number,
): Promise<KatsuraoMeetingRef[]> {
  const refs: KatsuraoMeetingRef[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const listUrl = buildListPageUrl(baseUrl || DEFAULT_BASE_URL, page);
    const html = await fetchPage(listUrl);
    if (!html) break;

    const pageRefs = parseListPage(html);
    if (pageRefs.length === 0) break;

    for (const ref of pageRefs) {
      if (ref.year !== year) continue;
      if (seen.has(ref.pageUrl)) continue;
      seen.add(ref.pageUrl);
      refs.push(ref);
    }

    if (!hasNextListPage(html, page)) break;
  }

  return refs;
}
