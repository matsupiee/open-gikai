/**
 * 和気町議会 -- list フェーズ
 *
 * 会議録一覧ページ (378.html) から全 PDF リンクを収集する。
 *
 * 全年度分が1ページに掲載されており、ページネーションは不要。
 *
 * 構造:
 *   <h3>令和7年</h3> などの見出し
 *   <a href="/material/files/group/14/{ID}.pdf">令和7年 第7回12月定例会 (PDFファイル: 1.1MB)</a>
 *
 * リンクテキストに年度・回次・月・種別が含まれる。
 * プロトコル省略形式（//www.town.wake.lg.jp/...）にも対応する。
 */

import {
  BASE_URL,
  convertHeadingToWesternYear,
  detectMeetingType,
  fetchPage,
  LIST_PAGE_URL,
  toHalfWidth,
} from "./shared";

export interface WakePdfLink {
  /** 会議タイトル（例: "令和7年 第7回12月定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度（西暦） */
  headingYear: number;
}

/**
 * リンクテキストから会議タイトルを正規化する。
 * 「令和7年 第7回12月定例会 (PDFファイル: 1.1MB)」 → 「令和7年 第7回12月定例会」
 */
function normalizeLinkText(text: string): string {
  return text
    .replace(/\(PDFファイル[^)]*\)/g, "")
    .replace(/（PDFファイル[^）]*）/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * URL を絶対 URL に正規化する。
 * プロトコル省略形式（//www.town.wake.lg.jp/...）にも対応する。
 */
function normalizeUrl(href: string): string {
  if (href.startsWith("//")) {
    return `https:${href}`;
  }
  if (href.startsWith("/")) {
    return `${BASE_URL}${href}`;
  }
  return href;
}

/**
 * リンクテキストから年度（西暦）を抽出する。
 * 「令和7年 第7回12月定例会」 → 2025
 */
function extractYearFromTitle(title: string): number | null {
  const normalized = toHalfWidth(title);

  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * 和気町のHTML構造（実際はプロトコル省略形式）:
 *   <a href="//www.town.wake.lg.jp/material/files/group/14/{ID}.pdf">令和7年 第7回12月定例会 (PDFファイル: 1.1MB)</a>
 *
 * リンクテキスト自体に年度情報が含まれるため、
 * 見出しタグとの位置関係ではなくリンクテキストから年度を抽出する。
 */
export function parseListPage(html: string): WakePdfLink[] {
  const results: WakePdfLink[] = [];

  // /material/files/group/14/ パターンの PDF リンクを抽出
  const linkPattern =
    /<a\s[^>]*href="((?:https?:)?\/\/[^"]*\/material\/files\/group\/14\/[^"]+\.pdf|\/material\/files\/group\/14\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;

  while ((am = linkPattern.exec(html)) !== null) {
    const href = am[1]!;
    const rawLinkText = am[2]!.replace(/<[^>]+>/g, "").trim();

    const linkText = toHalfWidth(normalizeLinkText(rawLinkText));
    if (!linkText) continue;

    // リンクテキストから年度を抽出
    const headingYear = extractYearFromTitle(linkText);
    if (!headingYear) continue;

    const pdfUrl = normalizeUrl(href);
    const meetingType = detectMeetingType(linkText);

    results.push({
      title: linkText,
      pdfUrl,
      meetingType,
      headingYear,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * LIST_PAGE_URL を取得し、全 PDF リンクをパースした後、
 * 対象年のものだけをフィルタリングして返す。
 */
export async function fetchDocumentList(year: number): Promise<WakePdfLink[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allLinks = parseListPage(html);
  return allLinks.filter((link) => link.headingYear === year);
}

export { convertHeadingToWesternYear };
