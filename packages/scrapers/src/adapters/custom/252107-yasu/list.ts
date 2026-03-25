/**
 * 野洲市議会 — list フェーズ
 *
 * インデックスページから年度別ページ URL を収集し、
 * 各年度ページから会議録 PDF リンクを収集する。
 *
 * URL 構造:
 *   インデックス: /gyoseijoho/gikai/teireikai-rinjikaikaigiroku/index.html
 *   年度別（令和2年以降）: /gyoseijoho/gikai/teireikai-rinjikaikaigiroku/{ID}.html
 *   年度別（旧形式）: /soshiki/gikai/teirei/{年号}/{ID}.html
 *   PDF: /material/files/group/2/{ファイル名}.pdf
 *
 * 目次 PDF（_mokuji.pdf）は除外し、本文 PDF のみを収集する。
 */

import {
  INDEX_URL,
  detectMeetingType,
  extractHeldOnFromFileName,
  extractYearFromTitle,
  fetchPage,
  resolveUrl,
} from "./shared";

export interface YasuMeetingRecord {
  /** 年度ページのタイトル（例: 令和6年） */
  sessionTitle: string;
  /** 会議録 PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日（YYYY-MM-DD）または null */
  heldOn: string | null;
  /** 年度ページの URL */
  yearPageUrl: string;
}

/**
 * インデックスページ HTML から年度別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * /teireikai-rinjikaikaigiroku/{数値}.html パターンのリンクを収集する。
 * また旧形式 /soshiki/gikai/teirei/ 配下のリンクも収集する。
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

    // 年度別ページのリンクを抽出（新形式・旧形式）
    const isNewFormat = /\/teireikai-rinjikaikaigiroku\/\d+\.html/.test(href);
    const isOldFormat = /\/soshiki\/gikai\/teirei\//.test(href);
    if (!isNewFormat && !isOldFormat) continue;

    const absoluteUrl = resolveUrl(href);
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);

    results.push({ url: absoluteUrl, title: rawTitle });
  }

  return results;
}

/**
 * PDF が目次ファイルかどうか判定する。
 * _mokuji.pdf で終わるファイルは目次として除外する。
 */
export function isMokujiPdf(pdfUrl: string): boolean {
  const fileName = pdfUrl.split("/").pop() ?? "";
  return fileName.endsWith("_mokuji.pdf");
}

/**
 * 年度別ページ HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * /material/files/group/2/*.pdf へのリンクを抽出する。
 * 目次 PDF（_mokuji.pdf）は除外する。
 */
export function parseYearPage(
  html: string,
  sessionTitle: string,
  yearPageUrl: string,
): YasuMeetingRecord[] {
  const results: YasuMeetingRecord[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;

    // material/files/group/2/ 配下の PDF のみ対象
    if (!href.includes("/material/files/group/2/") && !href.includes("material/files/group/2/")) {
      // 旧形式ではパスが異なる場合もあるので .pdf リンク全般を受け付ける
      if (!href.endsWith(".pdf")) continue;
    }

    const pdfUrl = resolveUrl(href);

    // 目次 PDF を除外
    if (isMokujiPdf(pdfUrl)) continue;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const fileName = pdfUrl.split("/").pop() ?? "";
    const heldOn = extractHeldOnFromFileName(fileName);
    const meetingType = detectMeetingType(sessionTitle);

    results.push({
      sessionTitle,
      pdfUrl,
      meetingType,
      heldOn,
      yearPageUrl,
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
 * インデックスページから全年度ページの URL とタイトルを取得する。
 */
export async function fetchYearPageEntries(): Promise<
  Array<{ url: string; title: string }>
> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return [];
  return parseIndexPage(html);
}

/**
 * 指定年の会議録 PDF リンクを収集する。
 *
 * インデックスページから全年度ページを取得し、
 * 各年度ページから会議録 PDF リンクを収集する。
 * 指定年に一致するレコードのみ返す。
 */
export async function fetchMeetingRecords(year: number): Promise<YasuMeetingRecord[]> {
  const entries = await fetchYearPageEntries();
  if (entries.length === 0) return [];

  const allRecords: YasuMeetingRecord[] = [];

  for (const entry of entries) {
    // タイトルから年を推定して早期フィルタリング
    const titleYear = extractYearFromTitle(entry.title);
    if (titleYear !== null && titleYear !== year) continue;

    const html = await fetchPage(entry.url);
    if (!html) continue;

    const records = parseYearPage(html, entry.title, entry.url);

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
