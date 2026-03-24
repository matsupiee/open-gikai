/**
 * 佐々町議会 会議録 -- list フェーズ
 *
 * 3 階層構成:
 *   1. トップページ (list00807.html) → 年度別一覧ページへのリンク (list{listID}.html)
 *   2. 年度別一覧 (list{listID}.html) → 会議詳細ページへのリンク (kiji{kijiID}/index.html)
 *   3. 会議詳細ページ (kiji{kijiID}/index.html) → PDF リンク（日ごと）
 *
 * PDF リンクのテキスト例:
 *   "12月17日（1日目）（PDF：974.7キロバイト）"
 *
 * 年度は年度別一覧ページのタイトル等から取得し、日付は PDF リンクテキストから抽出する。
 */

import {
  TOP_LIST_URL,
  convertWarekiToWesternYear,
  detectMeetingType,
  fetchPage,
  resolveUrl,
  toHalfWidth,
} from "./shared";

export interface SazaPdfLink {
  /** 会議録タイトル（例: "第4回定例会 12月17日（1日目）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
  /** 開催日（YYYY-MM-DD）。解析できない場合は null */
  heldOn: string | null;
}

/**
 * トップページ HTML から年度別一覧ページへのリンクを抽出する。
 *
 * 全体 HTML から `list{listID}.html` リンクを収集する（トップページ自体を除く）。
 * `.classArea2` 内には年度別一覧ページへのリンクが含まれているが、
 * ネストした div 構造により正規表現でのセクション抽出が難しいため全体から収集する。
 */
export function parseTopPage(html: string): Array<{ listUrl: string }> {
  const results: Array<{ listUrl: string }> = [];

  // list{listID}.html リンクをすべて抽出（トップページ自身 list00807.html は除外）
  const linkPattern = /href="([^"]*list\d{5}\.html)"/gi;
  const seen = new Set<string>();

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const resolved = resolveUrl(href, TOP_LIST_URL);
    // トップページ自身は除外
    if (resolved.includes("list00807")) continue;
    if (!seen.has(resolved)) {
      seen.add(resolved);
      results.push({ listUrl: resolved });
    }
  }

  return results;
}

/**
 * 年度別一覧ページ HTML から会議詳細ページへのリンクを抽出する。
 *
 * `.kijilist` 内の `kiji{kijiID}/index.html` リンクと会議名テキストを抽出する。
 */
export function parseYearListPage(
  html: string,
  listPageUrl: string,
): Array<{ detailUrl: string; meetingName: string }> {
  const results: Array<{ detailUrl: string; meetingName: string }> = [];

  // .kijilist 内部を抽出（なければ全体を対象）
  const kijiListMatch = html.match(
    /class="kijilist"[^>]*>([\s\S]*?)<\/(?:ul|div|section)>/i,
  );
  const searchHtml = kijiListMatch ? kijiListMatch[1]! : html;

  // kiji{kijiID}/index.html リンクを抽出
  const linkPattern =
    /<a[^>]*href="([^"]*kiji\d+\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of searchHtml.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const detailUrl = resolveUrl(href, listPageUrl);
    if (linkText) {
      results.push({ detailUrl, meetingName: linkText });
    }
  }

  return results;
}

/**
 * 月と日から YYYY-MM-DD 文字列を生成する。
 */
function buildDateString(
  year: number,
  month: number,
  day: number,
): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストから日付を抽出する。
 *
 * 対応パターン:
 *   "12月17日（1日目）（PDF：974.7キロバイト）" → { month: 12, day: 17 }
 */
export function parseDateFromLinkText(
  text: string,
): { month: number; day: number } | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]) };
}

/**
 * 年度ページのテキストから年度（西暦年）を推定する。
 *
 * ページタイトル等に含まれる和暦（例: 「令和6年」）から西暦年を返す。
 */
export function extractYearFromPageHtml(html: string): number | null {
  // <title> タグから和暦を探す
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const year = convertWarekiToWesternYear(titleMatch[1]!);
    if (year) return year;
  }

  // h1, h2, h3 から和暦を探す
  const headingPattern = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi;
  for (const m of html.matchAll(headingPattern)) {
    const year = convertWarekiToWesternYear(
      m[1]!.replace(/<[^>]+>/g, ""),
    );
    if (year) return year;
  }

  // ページ本文から最初に見つかった和暦
  const year = convertWarekiToWesternYear(html);
  if (year) return year;

  return null;
}

/**
 * リンクテキストからタイトルを正規化する。
 *
 * 例: "&nbsp;12月17日（1日目）（PDF：974.7キロバイト）&nbsp;" → "12月17日（1日目）"
 */
export function normalizePdfLinkText(text: string): string {
  return toHalfWidth(text)
    .replace(/&nbsp;/g, " ")
    .replace(/[（(]PDF[^）)]*[）)]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 会議詳細ページ HTML から PDF リンクを抽出する。
 *
 * `.danraku` 内の <a> タグから `.pdf` で終わる href を抽出する。
 * リンクテキストから日付を取得する。
 */
export function parseDetailPage(
  html: string,
  detailPageUrl: string,
  meetingName: string,
  year: number,
): SazaPdfLink[] {
  const results: SazaPdfLink[] = [];

  // .danraku 内部を抽出（なければ全体を対象）
  const danrakuMatch = html.match(
    /class="danraku"[^>]*>([\s\S]*?)<\/(?:div|section|p)>/i,
  );
  const searchHtml = danrakuMatch ? danrakuMatch[1]! : html;

  // .pdf で終わるリンクを抽出
  const linkPattern = /<a[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of searchHtml.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawLinkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const pdfUrl = resolveUrl(href, detailPageUrl);
    const linkText = normalizePdfLinkText(rawLinkText);

    // 日付を抽出
    const dateParts = parseDateFromLinkText(linkText);
    let heldOn: string | null = null;
    if (dateParts) {
      heldOn = buildDateString(year, dateParts.month, dateParts.day);
    }

    // タイトル: 会議名 + リンクテキスト（例: "第4回定例会 12月17日（1日目）"）
    const title = linkText
      ? `${meetingName} ${linkText}`
      : meetingName;

    results.push({
      title,
      pdfUrl,
      meetingType: detectMeetingType(meetingName),
      year,
      heldOn,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンク一覧を取得する。
 *
 * 1. トップページから年度別一覧ページを取得
 * 2. 対象年の年度別一覧ページから会議詳細ページを取得
 * 3. 各会議詳細ページから PDF リンクを収集
 */
export async function fetchDocumentList(year: number): Promise<SazaPdfLink[]> {
  // Step 1: トップページから年度別一覧ページの URL を取得
  const topHtml = await fetchPage(TOP_LIST_URL);
  if (!topHtml) return [];

  const yearListPages = parseTopPage(topHtml);

  // Step 2: 各年度別一覧ページをチェックして、対象年のものを特定
  const results: SazaPdfLink[] = [];

  for (const { listUrl } of yearListPages) {
    const listHtml = await fetchPage(listUrl);
    if (!listHtml) continue;

    const pageYear = extractYearFromPageHtml(listHtml);
    if (!pageYear || pageYear !== year) continue;

    // Step 3: 会議詳細ページへのリンクを抽出
    const detailLinks = parseYearListPage(listHtml, listUrl);

    // Step 4: 各会議詳細ページから PDF リンクを収集
    for (const { detailUrl, meetingName } of detailLinks) {
      const detailHtml = await fetchPage(detailUrl);
      if (!detailHtml) continue;

      const pdfLinks = parseDetailPage(detailHtml, detailUrl, meetingName, year);
      results.push(...pdfLinks);
    }

    // 対象年が見つかったら終了
    break;
  }

  return results;
}
