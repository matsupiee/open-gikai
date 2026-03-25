/**
 * 東北町議会 — list フェーズ
 *
 * サイト: https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku.html
 *
 * スクレイピング方針:
 * 1. トップページから最新年度のPDFリンクを収集
 * 2. 過去の会議録一覧ページ（-01.html）から年度別ページのリンクを収集
 * 3. 各年度ページから PDF リンクを収集
 *
 * PDFリンクは div.contents-left 内の p > a[href^="file/"] から取得。
 */

import {
  BASE_URL,
  PAST_LIST_URL,
  TOP_PAGE_URL,
  fetchPage,
  parseLinkText,
  resolveHref,
} from "./shared";

export interface TohokuRecord {
  pdfUrl: string;
  title: string;
  year: number;
  session: string;
  speakerName: string;
}

/**
 * HTML ページ内の div.contents-left から PDF リンクを収集する（純粋関数）。
 *
 * - `p > a[href^="file/"]` のリンクを対象とする
 * - リンクテキストから年度・定例会回次・議員名を抽出
 * - 指定年に一致するレコードのみ返す
 */
export function parsePageForPdfLinks(
  html: string,
  targetYear: number,
): TohokuRecord[] {
  const results: TohokuRecord[] = [];

  // div.contents-left の中身を取得
  const contentsMatch = html.match(
    /<div[^>]+class="[^"]*contents-left[^"]*"[^>]*>([\s\S]*?)<\/div>/,
  );
  const body = contentsMatch ? contentsMatch[1]! : html;

  // p タグ内の a タグで href が file/ で始まるリンクを収集
  const linkPattern = /<p[^>]*>[\s\S]*?<a[^>]+href="(file\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of body.matchAll(linkPattern)) {
    const href = match[1]!;
    const innerHtml = match[2]!;
    const linkText = innerHtml.replace(/<[^>]+>/g, "").trim();

    const { year, session, speakerName } = parseLinkText(linkText);
    if (year === null || session === null || speakerName === null) continue;
    if (year !== targetYear) continue;

    const pdfUrl = resolveHref(href);

    results.push({
      pdfUrl,
      title: linkText.replace(/【PDF】.*$/, "").trim(),
      year,
      session,
      speakerName,
    });
  }

  return results;
}

/**
 * 過去の会議録一覧ページから年度別ページの URL を収集する（純粋関数）。
 *
 * リンクのパターン: href="gikai_kaigiroku-{NN}.html"（-01 を除く）
 */
export function parsePastListPage(html: string): string[] {
  const urls: string[] = [];

  // div.contents-left の中身を取得
  const contentsMatch = html.match(
    /<div[^>]+class="[^"]*contents-left[^"]*"[^>]*>([\s\S]*?)<\/div>/,
  );
  const body = contentsMatch ? contentsMatch[1]! : html;

  const linkPattern =
    /<a[^>]+href="(gikai_kaigiroku-(\d+)\.html)"[^>]*>/gi;

  for (const match of body.matchAll(linkPattern)) {
    const href = match[1]!;
    const num = match[2]!;
    // -01.html は過去一覧ページ自身のリンクなのでスキップ
    if (num === "01") continue;
    urls.push(BASE_URL + href);
  }

  return urls;
}

/**
 * 指定年の全 PDF リンクを取得する。
 *
 * 1. トップページ（最新年度）をスキャン
 * 2. 過去の会議録一覧ページから年度別ページ URL を取得し、それぞれをスキャン
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number,
): Promise<TohokuRecord[]> {
  const results: TohokuRecord[] = [];

  // 1. トップページを解析
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (topHtml) {
    const topRecords = parsePageForPdfLinks(topHtml, year);
    results.push(...topRecords);
  }

  // 2. 過去の会議録一覧ページから年度別ページ URL を取得
  const pastHtml = await fetchPage(PAST_LIST_URL);
  if (pastHtml) {
    const yearPageUrls = parsePastListPage(pastHtml);

    for (const yearPageUrl of yearPageUrls) {
      const yearHtml = await fetchPage(yearPageUrl);
      if (!yearHtml) continue;

      const yearRecords = parsePageForPdfLinks(yearHtml, year);
      results.push(...yearRecords);
    }
  }

  return results;
}
