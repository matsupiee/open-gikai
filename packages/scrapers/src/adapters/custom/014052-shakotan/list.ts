/**
 * 積丹町議会 -- list フェーズ
 *
 * 2段階クロールで PDF リンクを収集する。
 *
 * Step 1: トップページ (content0730.html) から年度別ページへのリンクを収集
 *   - <div class="richtext"> 内の <ul> <a> タグから年度別リンクを抽出
 *   - リンクテキストから年度情報を取得（例: 「令和７年」）
 *
 * Step 2: 各年度別ページから PDF リンクを収集
 *   - <div class="richtext"> 内の .pdf で終わるリンクを抽出
 *   - リンクテキストから会議種別・回次を取得
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_PATH,
  convertHeadingToWesternYear,
  detectMeetingType,
  fetchPage,
  resolveUrl,
  toHalfWidth,
} from "./shared";

export interface ShakotanYearLink {
  /** 西暦年 */
  year: number;
  /** 年度別ページの絶対 URL */
  pageUrl: string;
}

export interface ShakotanPdfLink {
  /** 会議タイトル（例: "令和7年第4回積丹町議会定例会の結果"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** リンクテキストから抽出した西暦年 */
  headingYear: number;
}

/**
 * リンクテキストから会議タイトルを正規化する。
 * 全角数字を半角に変換し、余分な空白を除去する。
 */
export function normalizeLinkText(text: string): string {
  return toHalfWidth(text.replace(/\s+/g, " ").trim());
}

/**
 * トップページ HTML から年度別ページへのリンクを抽出する。
 *
 * <div class="richtext"> 内の <ul> <li> <a> タグを解析する。
 * リンクテキストに「令和」または「平成」が含まれるものを対象とする。
 *
 * フォールバック: richtext div が存在しない場合はページ全体から
 * 同じ条件でリンクを抽出する。
 */
export function parseTopPage(html: string): ShakotanYearLink[] {
  const results: ShakotanYearLink[] = [];

  // richtext div 内のコンテンツを抽出、なければページ全体を使う
  const richtextMatch = html.match(
    /<div\s[^>]*class="[^"]*richtext[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const content = richtextMatch ? richtextMatch[1]! : html;

  // a タグを抽出
  const linkPattern = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = linkPattern.exec(content)) !== null) {
    const href = am[1]!;
    const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();

    // 令和・平成を含むリンクテキストのみ対象
    if (!linkText.includes("令和") && !linkText.includes("平成")) continue;

    const year = convertHeadingToWesternYear(linkText);
    if (!year) continue;

    const pageUrl = resolveUrl(href);
    results.push({ year, pageUrl });
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 *
 * <div class="richtext"> 内の .pdf で終わる href を持つ <a> タグを収集する。
 *
 * フォールバック: richtext div が存在しない場合はページ全体から PDF リンクを抽出する。
 */
export function parseYearPage(
  html: string,
  headingYear: number,
): ShakotanPdfLink[] {
  const results: ShakotanPdfLink[] = [];

  // richtext div 内のコンテンツを抽出、なければページ全体を使う
  const richtextMatch = html.match(
    /<div\s[^>]*class="[^"]*richtext[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const content = richtextMatch ? richtextMatch[1]! : html;

  // a タグを抽出
  const linkPattern = /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = linkPattern.exec(content)) !== null) {
    const href = am[1]!;
    const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();

    // PDF 以外をスキップ
    if (!href.toLowerCase().endsWith(".pdf")) continue;

    const title = normalizeLinkText(linkText);
    if (!title) continue;

    // リンクテキストから年度情報を取得（テキストに含まれていれば上書き）
    const yearFromTitle = convertHeadingToWesternYear(title);
    const resolvedYear = yearFromTitle ?? headingYear;

    const pdfUrl = resolveUrl(href, BASE_ORIGIN);
    const meetingType = detectMeetingType(title);

    results.push({
      title,
      pdfUrl,
      meetingType,
      headingYear: resolvedYear,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * 1. トップページから年度別ページリンクを取得
 * 2. 対象年のページを fetch して PDF リンクを収集
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<ShakotanPdfLink[]> {
  const topUrl = baseUrl || `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
  const html = await fetchPage(topUrl);
  if (!html) return [];

  const yearLinks = parseTopPage(html);

  // 対象年のページを探す
  const targetLink = yearLinks.find((link) => link.year === year);
  if (!targetLink) return [];

  const yearPageHtml = await fetchPage(targetLink.pageUrl);
  if (!yearPageHtml) return [];

  const pdfLinks = parseYearPage(yearPageHtml, year);
  return pdfLinks.filter((link) => link.headingYear === year);
}
