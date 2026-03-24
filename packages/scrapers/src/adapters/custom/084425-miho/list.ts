/**
 * 美浦村議会 -- list フェーズ
 *
 * 2段階クロール:
 *   1. 会議録トップページから年度別ページのリンクを収集
 *   2. 年度別ページから PDF リンクを収集
 *
 * 対象年度の会議録のみを抽出し、PDF URL・会議名・会議種別を返す。
 *
 * URL 構造:
 *   - トップ: https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/
 *   - 年度別: .../gikaikaigiroku/page{ID}.html
 *   - PDF: https://www.vill.miho.lg.jp/data/doc/{TIMESTAMP}_doc_165_{INDEX}.pdf
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface MihoPdfRecord {
  /** 会議タイトル（例: "令和6年第4回定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfRecordList(
  _baseUrl: string,
  year: number
): Promise<MihoPdfRecord[]> {
  // Step 1: トップページから年度別ページのリンクを収集
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const yearLinks = parseYearPageLinks(topHtml);

  // Step 2: 対象年度のリンクを絞り込む
  const targetLinks = yearLinks.filter((link) => {
    const seirekiYear = parseWarekiYear(link.title);
    return seirekiYear !== null && seirekiYear === year;
  });

  if (targetLinks.length === 0) return [];

  const allRecords: MihoPdfRecord[] = [];

  for (const yearLink of targetLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const yearHtml = await fetchPage(yearLink.url);
    if (!yearHtml) continue;

    const pdfLinks = parsePdfLinks(yearHtml);
    allRecords.push(...pdfLinks);
  }

  return allRecords;
}

// --- HTML パーサー（テスト用に export） ---

export interface YearPageLink {
  /** リンクテキスト（例: "2024年（令和6年）　村議会会議録"） */
  title: string;
  /** 年度別ページの絶対 URL */
  url: string;
}

/**
 * トップページ HTML から年度別ページへのリンクを抽出する。
 * リンク形式（絶対URL）:
 *   <a href="https://www.vill.miho.lg.jp/.../gikaikaigiroku/page013511.html">2024年（令和6年）...</a>
 * リンク形式（相対URL）:
 *   <a href="page013511.html">2024年（令和6年）...</a>
 */
export function parseYearPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  // href が page{ID}.html を含むリンクを抽出（絶対URL・相対URL両対応）
  const pattern = /<a\s[^>]*href="([^"]*page\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    // 年度名（令和X年 / 平成X年 / 西暦年）を含むもののみ対象
    if (!/(?:令和|平成|\d{4}年)/.test(title)) continue;

    // 絶対URLはそのまま、相対URLはベースを付加
    const url = href.startsWith("http")
      ? href
      : `${TOP_PAGE_URL}${href}`;

    if (seen.has(url)) continue;
    seen.add(url);

    links.push({ title, url });
  }

  return links;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 * PDF URL 形式: https://www.vill.miho.lg.jp/data/doc/{TIMESTAMP}_doc_165_{INDEX}.pdf
 * リンクテキスト例: "令和6年第4回定例会 [PDF形式／717.5KB]"
 */
export function parsePdfLinks(html: string): MihoPdfRecord[] {
  const records: MihoPdfRecord[] = [];

  // data/doc/ 以下の PDF リンクを抽出
  const pdfPattern =
    /<a\s[^>]*href="((?:https?:\/\/[^"]*|[^"]*?)\/data\/doc\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    let href = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();

    // 相対 URL を絶対 URL に変換
    if (!href.startsWith("http")) {
      href = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    // 会議名を抽出（"[PDF形式／..." の前まで）
    const titleMatch = linkText.match(/^(.+?)(?:\s*[\[【]|$)/);
    const rawTitle = titleMatch?.[1]?.trim() ?? linkText;

    // 会議名が令和/平成年を含むものに限定
    if (!/(?:令和|平成)/.test(rawTitle)) continue;

    records.push({
      title: rawTitle,
      pdfUrl: href,
      meetingType: detectMeetingType(rawTitle),
    });
  }

  return records;
}
