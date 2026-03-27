/**
 * 下條村議会 — list フェーズ
 *
 * 議会だより一覧ページから PDF リンクを収集する。
 *
 * 一覧ページ: https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikaidayori/index.html
 *
 * PDF ファイル名例:
 *   files/20220714134025.pdf   (タイムスタンプ型)
 *   files/2024-0115-0943.pdf  (日付型)
 *
 * 詳細ページ URL 例:
 *   https://www.vill-shimojo.jp/gyousei/simojomura_songikai/gikaidayori/2022-0714-1340-1.html
 */

import {
  BASE_ORIGIN,
  GIKAIDAYORI_LIST_URL,
  GIKAIDAYORI_BASE_URL,
  eraToWesternYear,
  fetchPage,
} from "./shared";

export interface ShimojoDayori {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * PDF ファイル名（タイムスタンプ）から発行年を推定する。
 *
 * ファイル名パターン:
 *   "20220714134025.pdf" → year=2022, month=7, day=14
 *   "2024-0115-0943.pdf" → year=2024, month=1, day=15
 *   "2023-0531-1747.pdf" → year=2023, month=5, day=31
 */
export function parsePdfFilenameDate(filename: string): {
  year: number;
  month: number;
  day: number;
} | null {
  // パターン1: "20220714134025" (14桁)
  const longTs = filename.match(/^(\d{4})(\d{2})(\d{2})\d+\.pdf$/i);
  if (longTs) {
    return {
      year: Number(longTs[1]),
      month: Number(longTs[2]),
      day: Number(longTs[3]),
    };
  }

  // パターン2: "2024-0115-0943" (日付ハイフン区切り)
  const dashTs = filename.match(/^(\d{4})-(\d{2})(\d{2})-\d+\.pdf$/i);
  if (dashTs) {
    return {
      year: Number(dashTs[1]),
      month: Number(dashTs[2]),
      day: Number(dashTs[3]),
    };
  }

  return null;
}

/**
 * リンクテキストや周辺テキストから号数を抽出する。
 * e.g., "第12号" → 12, "12号" → 12
 */
export function parseIssueNumber(text: string): number | null {
  const match = text.match(/第?(\d+)号/);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * リンクテキストから発行日を抽出する。
 * e.g., "令和6年1月15日発行" → { year: 2024, month: 1, day: 15 }
 */
export function parsePublishDate(text: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;
  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;
  return {
    year,
    month: Number(match[3]),
    day: Number(match[4]),
  };
}

/**
 * heldOn 文字列を YYYY-MM-DD 形式で組み立てる。
 */
export function buildHeldOn(
  year: number,
  month: number,
  day: number
): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * HTML からの相対 or 絶対 URL を絶対 URL に変換する。
 */
export function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${baseUrl}${href}`;
}

/**
 * HTML の詳細ページ URL（.html）のファイル名部分から日付を推定する。
 *
 * URL パターン: "2021-0415-1040-1.html" → year=2021, month=4, day=15
 */
export function parseHtmlFilenameDate(filename: string): {
  year: number;
  month: number;
  day: number;
} | null {
  // パターン: "YYYY-MMDD-HHMM(-N).html"
  const match = filename.match(/^(\d{4})-(\d{2})(\d{2})-\d+/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }
  return null;
}

/**
 * 一覧ページの HTML をパースして PDF / HTML リンク情報を返す（テスト可能な純粋関数）。
 *
 * 収集対象:
 *   - href に files/*.pdf を含む直接 PDF リンク
 *   - href に gikaidayori/*.html を含む詳細ページリンク（2021年以前の形式）
 */
export function parseListPage(html: string): ShimojoDayori[] {
  const results: ShimojoDayori[] = [];

  // PDF の直接リンクを収集（href に files/ を含む）
  const pdfLinkPattern =
    /<a[^>]+href="([^"]*files\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfLinkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const pdfUrl = resolveUrl(href, GIKAIDAYORI_BASE_URL);

    // ファイル名から日付を推定
    const filename = href.split("/").pop() ?? "";
    const filenameDate = parsePdfFilenameDate(filename);

    // リンクテキストから日付を試みる
    const textDate = parsePublishDate(linkText);

    const dateInfo = textDate ?? filenameDate;
    if (!dateInfo) continue;

    // 前後コンテキストから号数を探す (マッチ位置の前後 200 文字)
    const contextStart = Math.max(0, (match.index ?? 0) - 200);
    const contextEnd = Math.min(
      html.length,
      (match.index ?? 0) + match[0]!.length + 200
    );
    const context = html.slice(contextStart, contextEnd).replace(/<[^>]+>/g, "");

    const issueNum = parseIssueNumber(context) ?? parseIssueNumber(linkText);
    const title = issueNum
      ? `下條村議会だより 第${issueNum}号`
      : `下條村議会だより ${dateInfo.year}年${dateInfo.month}月`;

    results.push({
      pdfUrl,
      title,
      heldOn: buildHeldOn(dateInfo.year, dateInfo.month, dateInfo.day),
      section: "議会だより",
    });
  }

  // HTML 詳細ページリンクを収集（gikaidayori/ 配下の .html、files/ や index を除く）
  const htmlLinkPattern =
    /<a[^>]+href="([^"]*gikaidayori\/(\d{4}-\d{4}-\d+-[^"]+\.html))"[^>]*>([\s\S]*?)<\/a>/gi;

  const seenUrls = new Set(results.map((r) => r.pdfUrl));

  for (const match of html.matchAll(htmlLinkPattern)) {
    const href = match[1]!;
    const filename = match[2]!;
    const linkText = match[3]!.replace(/<[^>]+>/g, "").trim();

    const pageUrl = resolveUrl(href, GIKAIDAYORI_BASE_URL);
    if (seenUrls.has(pageUrl)) continue;
    seenUrls.add(pageUrl);

    // ファイル名から日付を推定
    const filenameDate = parseHtmlFilenameDate(filename);

    // リンクテキストから日付を試みる
    const textDate = parsePublishDate(linkText);

    const dateInfo = textDate ?? filenameDate;
    if (!dateInfo) continue;

    // 前後コンテキストから号数を探す (マッチ位置の前後 200 文字)
    const contextStart = Math.max(0, (match.index ?? 0) - 200);
    const contextEnd = Math.min(
      html.length,
      (match.index ?? 0) + match[0]!.length + 200
    );
    const context = html.slice(contextStart, contextEnd).replace(/<[^>]+>/g, "");

    const issueNum = parseIssueNumber(context) ?? parseIssueNumber(linkText);
    const title = issueNum
      ? `下條村議会だより 第${issueNum}号`
      : `下條村議会だより ${dateInfo.year}年${dateInfo.month}月`;

    results.push({
      pdfUrl: pageUrl,
      title,
      heldOn: buildHeldOn(dateInfo.year, dateInfo.month, dateInfo.day),
      section: "議会だより",
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクのみを返す。
 */
export function filterByYear(
  items: ShimojoDayori[],
  year: number
): ShimojoDayori[] {
  return items.filter((item) => item.heldOn.startsWith(`${year}-`));
}

/**
 * 一覧ページを取得して指定年の議会だより一覧を返す。
 */
export async function fetchMeetingList(year: number): Promise<ShimojoDayori[]> {
  const html = await fetchPage(GIKAIDAYORI_LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);
  return filterByYear(all, year);
}
