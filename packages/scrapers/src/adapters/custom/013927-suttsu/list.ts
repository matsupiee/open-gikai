/**
 * 寿都町議会 議会だより — list フェーズ
 *
 * 議会だより一覧ページ（detail.php?id=63）から全 PDF リンクを収集する。
 *
 * HTML 構造:
 *   <ul class="pdf-list" id="content-1">
 *     <li><a href="../common/img/content/cassette_1_pdf01_20160913_174423.pdf" target="_blank">NO.140号（平成21年2月発行）</a></li>
 *     ...
 *   </ul>
 *
 * - 各 <ul> はカセット番号（id="content-1" 〜 id="content-8"）に対応
 * - <li> 内の <a> タグに PDF への相対パスリンクとリンクテキスト（号数・発行時期）が含まれる
 * - 1ページに全号が掲載される（ページネーションなし）
 */

import { LIST_PAGE_URL, fetchPage, toHalfWidth } from "./shared";

export interface SuttuPdfRecord {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（例: "NO.208号（令和8年2月発行）"） */
  linkText: string;
  /** 号数（例: 208） */
  issueNumber: number | null;
  /** 発行年（西暦） */
  publishYear: number | null;
  /** 発行月 */
  publishMonth: number | null;
}

/**
 * リンクテキストから号数を抽出する。
 * 例: "NO.208号（令和8年2月発行）" → 208
 * 全角・半角数字の両方に対応。
 */
export function parseIssueNumber(linkText: string): number | null {
  const normalized = toHalfWidth(linkText);
  // NO.XXX号 または ＮＯ.XXX号 などのパターン
  const match = normalized.match(/[NＮ][OＯ][.．]?\s*(\d+)\s*号/i);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

/**
 * リンクテキストから発行年月を抽出する。
 * 例: "NO.208号（令和8年2月発行）" → { year: 2026, month: 2 }
 */
export function parsePublishDate(linkText: string): { year: number; month: number } | null {
  const normalized = toHalfWidth(linkText);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月/);
  if (!match) return null;

  const [, era, yearPart, monthStr] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);
  const month = parseInt(monthStr!, 10);

  let year: number;
  if (era === "令和") year = eraYear + 2018;
  else if (era === "平成") year = eraYear + 1988;
  else return null;

  if (month < 1 || month > 12) return null;

  return { year, month };
}

/**
 * 相対パスを絶対 URL に変換する。
 * 例: "../common/img/content/cassette_1_pdf01_20160913_174423.pdf"
 *   → "http://www.town.suttu.lg.jp/common/img/content/cassette_1_pdf01_20160913_174423.pdf"
 */
export function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  // 相対パスを正規化: ../ プレフィックスを除去して絶対パスに
  const normalizedHref = href.replace(/^(\.\.\/)+/, "/");
  const origin = new URL(baseUrl).origin;
  return `${origin}${normalizedHref.startsWith("/") ? "" : "/"}${normalizedHref}`;
}

/**
 * 議会だより一覧ページ HTML から全 PDF リンクを抽出する。
 *
 * @param html - 一覧ページの HTML
 * @param pageUrl - ベース URL（相対パス解決用）
 */
export function parsePdfLinks(html: string, pageUrl: string): SuttuPdfRecord[] {
  const results: SuttuPdfRecord[] = [];

  // ul.pdf-list 内の a タグを抽出
  const pdfListPattern = /<ul[^>]*class="[^"]*pdf-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  let ulMatch: RegExpExecArray | null;

  while ((ulMatch = pdfListPattern.exec(html)) !== null) {
    const ulContent = ulMatch[1]!;
    const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;

    while ((am = linkPattern.exec(ulContent)) !== null) {
      const href = am[1]!;
      const rawText = am[2]!.replace(/<[^>]+>/g, "").trim();

      const pdfUrl = resolveUrl(href, pageUrl);
      const issueNumber = parseIssueNumber(rawText);
      const dateInfo = parsePublishDate(rawText);

      results.push({
        pdfUrl,
        linkText: rawText,
        issueNumber,
        publishYear: dateInfo?.year ?? null,
        publishMonth: dateInfo?.month ?? null,
      });
    }
  }

  return results;
}

/**
 * 指定年の PDF 一覧を取得する。
 * 一覧ページから全 PDF を収集し、発行年でフィルタリングする。
 */
export async function fetchPdfList(year: number): Promise<SuttuPdfRecord[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allRecords = parsePdfLinks(html, LIST_PAGE_URL);

  // 発行年でフィルタリング（publishYear が null の場合も含める）
  return allRecords.filter((r) => r.publishYear === null || r.publishYear === year);
}
