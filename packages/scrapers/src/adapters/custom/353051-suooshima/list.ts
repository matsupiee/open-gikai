/**
 * 周防大島町議会 -- list フェーズ
 *
 * 1. 議事録一覧ページ (list18-56.html) から全詳細ページ URL を収集
 * 2. 各詳細ページにアクセスし、タイトルと PDF URL を取得
 * 3. 指定年度に絞り込んで返す
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface SuooshimaSessionInfo {
  /** 会議タイトル（例: "令和7年 本会議 第4回定例会会議録"） */
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

const LIST_URL = `${BASE_ORIGIN}/site/gikai/list18-56.html`;
const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページ HTML から詳細ページ URL を抽出する（純粋関数）。
 *
 * パターン: /site/gikai/{数値}.html
 */
export function parseListPage(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="([^"]*\/site\/gikai\/(\d+)\.html)"/gi;
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
 * 詳細ページ HTML からタイトルと PDF リンクを抽出する（純粋関数）。
 *
 * タイトルパターン: "令和7年 本会議　第4回定例会会議録"
 * PDF パターン: /uploaded/attachment/{数値}.pdf
 */
export function parseDetailPage(html: string, detailUrl: string): {
  title: string;
  year: number | null;
  meetingType: string;
  pdfUrls: string[];
} | null {
  // タイトルを取得（h2 またはページタイトルから）
  const titleMatch =
    html.match(/<h2[^>]*class="[^"]*article-body-title[^"]*"[^>]*>([^<]+)<\/h2>/i) ||
    html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i) ||
    html.match(/<h2[^>]*>\s*([^<]*(?:令和|平成)\d+年[^<]*(?:定例会|臨時会)[^<]*)\s*<\/h2>/i) ||
    html.match(/<title>([^<]*(?:令和|平成)\d+年[^<]*(?:定例会|臨時会)[^<]*)<\/title>/i) ||
    html.match(/<title>([^<]+)<\/title>/i);

  if (!titleMatch) return null;

  const rawTitle = titleMatch[1]!.replace(/\s+/g, " ").trim();

  // 和暦年を抽出
  const year = parseWarekiYear(rawTitle);
  if (year === null) return null;

  const meetingType = detectMeetingType(rawTitle);

  // タイトルのクリーンアップ（サイト名部分を除去）
  const titleClean = rawTitle
    .replace(/\s*[\|｜]\s*周防大島町.*$/, "")
    .replace(/\s*-\s*周防大島町.*$/, "")
    .trim();

  // PDF リンクを抽出 (/uploaded/attachment/{ID}.pdf)
  const pdfUrls: string[] = [];
  const pdfPattern = /href="([^"]*\/uploaded\/attachment\/\d+\.pdf)"/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pdfPattern.exec(html)) !== null) {
    const pdfUrl = new URL(pm[1]!, detailUrl).toString();
    pdfUrls.push(pdfUrl);
  }

  return { title: titleClean, year, meetingType, pdfUrls };
}

/**
 * 指定年度の全会議録 PDF 情報を収集する。
 */
export async function fetchMeetingList(
  year: number
): Promise<SuooshimaSessionInfo[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const detailUrls = parseListPage(listHtml);
  const results: SuooshimaSessionInfo[] = [];

  for (const detailUrl of detailUrls) {
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) {
      await delay(INTER_PAGE_DELAY_MS);
      continue;
    }

    const parsed = parseDetailPage(detailHtml, detailUrl);
    await delay(INTER_PAGE_DELAY_MS);

    if (!parsed || parsed.year !== year) continue;

    // 目次 PDF を除いたPDF（2枚目以降、または全部）を対象にする
    // ドキュメントによると1会議目は目次+本文で構成される。
    // 目次は通常最初の1つなので、本文PDFのみ（2枚目以降）を処理対象とする。
    // ただし、PDFが1つしかない場合はそれを処理する。
    const bodyPdfUrls = parsed.pdfUrls.length > 1 ? parsed.pdfUrls.slice(1) : parsed.pdfUrls;

    for (const pdfUrl of bodyPdfUrls) {
      results.push({
        title: parsed.title,
        year: parsed.year,
        pdfUrl,
        meetingType: parsed.meetingType,
        detailUrl,
      });
    }
  }

  return results;
}
