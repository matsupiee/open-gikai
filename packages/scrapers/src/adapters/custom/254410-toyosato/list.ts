/**
 * 豊郷町議会 — list フェーズ
 *
 * トップページから会議詳細ページ URL を収集し、
 * 各詳細ページから会議録 PDF リンクを収集する。
 *
 * トップページには全年度の会議リンクがまとめて掲載されており、
 * ページネーションなし（1ページに全件表示）。
 *
 * 各会議詳細ページ（{10桁ID}.html）には複数種別の PDF が掲載される。
 * リンクテキストに「会議録」が含まれる PDF のみを収集する。
 */

import {
  INDEX_URL,
  detectMeetingType,
  extractHeldOnFromPdf,
  extractYearFromTitle,
  fetchPage,
  resolveUrl,
} from "./shared";

export interface ToyosatoMeetingRecord {
  /** 会議名（例: 令和6年3月豊郷町議会定例会） */
  sessionTitle: string;
  /** 会議録 PDF の絶対 URL */
  pdfUrl: string;
  /** PDF のリンクテキスト（例: 3月6日　会議録） */
  linkText: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日（YYYY-MM-DD）または null */
  heldOn: string | null;
  /** 会議詳細ページの URL */
  detailPageUrl: string;
}

/**
 * トップページ HTML から会議詳細ページの URL とタイトルを抽出する（テスト可能な純粋関数）。
 *
 * /\d{10}\.html パターンのリンクを収集する。
 */
export function parseIndexPage(html: string): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawTitle = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 10桁IDのHTMLページのみ抽出
    if (!/\/\d{10}\.html/.test(href)) continue;

    const absoluteUrl = resolveUrl(href);
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);

    results.push({ url: absoluteUrl, title: rawTitle });
  }

  return results;
}

/**
 * リンクテキストが会議録 PDF かどうか判定する。
 *
 * リンクテキストに「会議録」が含まれる PDF のみを会議録として扱う。
 * 「会期日程」「一般質問」「採決結果」は除外する。
 */
export function isMeetingMinutes(linkText: string): boolean {
  return linkText.includes("会議録");
}

/**
 * 会議詳細ページ HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * href が .pdf で終わり、リンクテキストに「会議録」が含まれるリンクのみ収集する。
 */
export function parseDetailPage(
  html: string,
  sessionTitle: string,
  detailPageUrl: string,
): ToyosatoMeetingRecord[] {
  const results: ToyosatoMeetingRecord[] = [];

  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawLinkText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!isMeetingMinutes(rawLinkText)) continue;

    const pdfUrl = resolveUrl(href);
    const heldOn = extractHeldOnFromPdf(pdfUrl, rawLinkText, sessionTitle);
    const meetingType = detectMeetingType(sessionTitle);

    results.push({
      sessionTitle,
      pdfUrl,
      linkText: rawLinkText,
      meetingType,
      heldOn,
      detailPageUrl,
    });
  }

  return results;
}

/**
 * heldOn 文字列から年を取得する。
 */
export function extractYearFromHeldOn(heldOn: string | null): number | null {
  if (!heldOn) return null;
  const match = heldOn.match(/^(\d{4})-/);
  return match ? parseInt(match[1]!, 10) : null;
}

/**
 * トップページから全会議詳細ページの URL とタイトルを取得する。
 */
export async function fetchDetailPageEntries(): Promise<
  Array<{ url: string; title: string }>
> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return [];
  return parseIndexPage(html);
}

/**
 * 指定年の会議録 PDF リンクを収集する。
 *
 * トップページから全会議詳細ページを取得し、
 * 各詳細ページから会議録 PDF リンクを収集する。
 * 指定年に一致するレコードのみ返す。
 */
export async function fetchMeetingRecords(
  year: number,
): Promise<ToyosatoMeetingRecord[]> {
  const entries = await fetchDetailPageEntries();
  if (entries.length === 0) return [];

  const allRecords: ToyosatoMeetingRecord[] = [];

  for (const entry of entries) {
    // セッションタイトルから年を推定して早期フィルタリング
    const titleYear = extractYearFromTitle(entry.title);
    if (titleYear !== null && titleYear !== year) continue;

    const html = await fetchPage(entry.url);
    if (!html) continue;

    const records = parseDetailPage(html, entry.title, entry.url);

    for (const record of records) {
      const recordYear = extractYearFromHeldOn(record.heldOn);
      const fallbackYear = extractYearFromTitle(record.sessionTitle);
      const effectiveYear = recordYear ?? fallbackYear;
      if (effectiveYear === year) {
        allRecords.push(record);
      }
    }
  }

  return allRecords;
}
