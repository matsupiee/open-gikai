/**
 * 田布施町議会 -- list フェーズ
 *
 * 3階層構造:
 * 1. 会議録一覧ページ (list7.html) → 年度別一覧ページ URL を収集
 * 2. 各年度別一覧ページ (list7-{ID}.html) → 詳細ページ URL を収集
 * 3. 各詳細ページ ({記事ID}.html) → PDF URL とメタ情報を取得
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface TabuseSessionInfo {
  /** 会議タイトル（例: "令和6年第7回(12月)定例会会議録"） */
  title: string;
  /** 開催年（西暦） */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページ URL */
  detailUrl: string;
}

const LIST_URL = `${BASE_ORIGIN}/site/gikai/list7.html`;
const INTER_PAGE_DELAY_MS = 1500;

/**
 * 会議録一覧ページ HTML から年度別一覧ページ URL を抽出する（純粋関数）。
 *
 * パターン: /site/gikai/list7-{数値}.html
 */
export function parseTopListPage(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="([^"]*\/site\/gikai\/list7-(\d+)\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const absoluteUrl = new URL(href, LIST_URL).toString();
    if (!seen.has(absoluteUrl)) {
      seen.add(absoluteUrl);
      urls.push(absoluteUrl);
    }
  }

  return urls;
}

/**
 * 年度別一覧ページ HTML から詳細ページ URL を抽出する（純粋関数）。
 *
 * パターン: /site/gikai/{数値}.html （list7-{ID}.html ではないもの）
 */
export function parseYearListPage(html: string, yearListUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="([^"]*\/site\/gikai\/(\d+)\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    // list7-{ID}.html 形式は除外（詳細ページのみ対象）
    if (/\/site\/gikai\/list7/.test(href)) continue;
    const absoluteUrl = new URL(href, yearListUrl).toString();
    if (!seen.has(absoluteUrl)) {
      seen.add(absoluteUrl);
      urls.push(absoluteUrl);
    }
  }

  return urls;
}

/**
 * 詳細ページ HTML からタイトルと PDF リンクを抽出する（純粋関数）。
 *
 * PDF パターン: /uploaded/attachment/{数値}.pdf
 * タイトル形式: "令和6年第7回(12月)定例会会議録 [PDFファイル／2.21MB]"
 */
export function parseDetailPage(
  html: string,
  detailUrl: string
): {
  pdfs: Array<{ url: string; title: string; year: number; meetingType: string }>;
} {
  const pdfs: Array<{ url: string; title: string; year: number; meetingType: string }> = [];

  // ul.file_list 内の PDF リンクを抽出
  const pdfLinkPattern =
    /href="([^"]*\/uploaded\/attachment\/\d+\.pdf)"[^>]*>\s*([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = pdfLinkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();
    const pdfUrl = new URL(href, detailUrl).toString();

    // リンクテキストから年度を抽出
    const year = parseWarekiYear(linkText);
    if (year === null) continue;

    // タイトルからファイルサイズ部分を除去 (例: " [PDFファイル／2.21MB]")
    const title = linkText.replace(/\s*\[PDFファイル[^\]]*\]\s*$/, "").trim();
    const meetingType = detectMeetingType(linkText);

    pdfs.push({ url: pdfUrl, title, year, meetingType });
  }

  return { pdfs };
}

/**
 * 指定年度の全会議録 PDF 情報を収集する。
 */
export async function fetchMeetingList(year: number): Promise<TabuseSessionInfo[]> {
  const topHtml = await fetchPage(LIST_URL);
  if (!topHtml) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const yearListUrls = parseTopListPage(topHtml);
  const results: TabuseSessionInfo[] = [];

  for (const yearListUrl of yearListUrls) {
    const yearHtml = await fetchPage(yearListUrl);
    if (!yearHtml) {
      await delay(INTER_PAGE_DELAY_MS);
      continue;
    }

    await delay(INTER_PAGE_DELAY_MS);

    const detailUrls = parseYearListPage(yearHtml, yearListUrl);

    for (const detailUrl of detailUrls) {
      const detailHtml = await fetchPage(detailUrl);
      if (!detailHtml) {
        await delay(INTER_PAGE_DELAY_MS);
        continue;
      }

      await delay(INTER_PAGE_DELAY_MS);

      const { pdfs } = parseDetailPage(detailHtml, detailUrl);

      for (const pdf of pdfs) {
        if (pdf.year !== year) continue;
        results.push({
          title: pdf.title,
          year: pdf.year,
          pdfUrl: pdf.url,
          meetingType: pdf.meetingType,
          detailUrl,
        });
      }
    }
  }

  return results;
}
