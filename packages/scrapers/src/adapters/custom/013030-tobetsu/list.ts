/**
 * 当別町議会 会議録 — list フェーズ
 *
 * 会議録一覧ページ → 年度別ページ → PDF リンクの順でクロールする。
 *
 * 会議録一覧ページ（18717.html）:
 *   年度別ページへのリンク（/site/gikai/{ページID}.html）が列挙されている
 *
 * 年度別ページ構造:
 *   各定例会・臨時会ごとに PDF リンクが箇条書きで掲載されている
 *   リンク: /uploaded/attachment/{ファイルID}.pdf
 *   リンクテキスト: 「第1回定例会（3月）」等
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  eraToWesternYear,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface TobetsuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年第1回定例会（3月）"） */
  title: string;
  /** 開催年（西暦、リンクテキストから解析） */
  year: number;
  /** 会議種別（"plenary" / "extraordinary"） */
  category: string;
  /** 外部 ID 用のキー（例: "013030_12345"） */
  pdfKey: string;
}

/**
 * 会議録一覧ページから年度別ページへのリンクを抽出する。
 *
 * リンクパターン: /site/gikai/{ページID}.html
 * ただし 18717.html（一覧ページ自身）は除外する。
 */
export function parseListPage(html: string): string[] {
  const urls: string[] = [];
  const pattern = /href="(\/site\/gikai\/(\d+)\.html)"/gi;

  for (const match of html.matchAll(pattern)) {
    const path = match[1]!;
    const pageId = match[2]!;
    // 一覧ページ自身（18717）はスキップ
    if (pageId === "18717") continue;
    const url = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度別ページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * PDF リンクパターン: /uploaded/attachment/{ファイルID}.pdf
 * リンクテキスト例:
 *   「令和6年第1回定例会（3月）」
 *   「令和6年第4回定例会（12月）」
 *   「令和6年第1回臨時会」
 */
export function parseYearPage(html: string, pageYear: number): TobetsuMeeting[] {
  const results: TobetsuMeeting[] = [];

  // PDF リンクを含む <a> タグを抽出
  const linkPattern = /<a[^>]+href="(\/uploaded\/attachment\/(\d+)\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const pdfPath = match[1]!;
    const fileId = match[2]!;
    const rawText = match[3]!.replace(/<[^>]+>/g, "").trim();

    // ファイルサイズ等の補足情報を除去（例: "第1回定例会（3月）\n[PDFファイル/154KB]"）
    const titleText = rawText
      .split(/[\n\r]/)[0]!
      .replace(/\[.+?\]/g, "")
      .trim();

    if (!titleText) continue;

    const pdfUrl = `${BASE_ORIGIN}${pdfPath}`;
    const pdfKey = `013030_${fileId}`;
    const category = titleText.includes("臨時会") ? "extraordinary" : "plenary";

    // リンクテキストから年度を抽出（「令和6年...」等）
    const halfWidth = toHalfWidth(titleText);
    const eraMatch = halfWidth.match(/(令和|平成)(元|\d+)年/);
    let year = pageYear;
    if (eraMatch) {
      const extracted = eraToWesternYear(`${eraMatch[1]}${eraMatch[2]}年`);
      if (extracted) year = extracted;
    }

    // タイトルに年度が含まれない場合はページの年度を使って補完
    const title = eraMatch ? titleText : titleText;

    results.push({
      pdfUrl,
      title: title || titleText,
      year,
      category,
      pdfKey,
    });
  }

  return results;
}

/**
 * 年度別ページの URL から想定される西暦年を推定する。
 * 年度別ページの <h2> や <title> から年度情報を抽出する。
 * 失敗した場合は 0 を返す（呼び出し側でフォールバックを検討）。
 */
export function extractYearFromPageHtml(html: string): number {
  const halfWidth = toHalfWidth(html);
  // <title> や <h1>/<h2> などから年度を抽出
  const eraMatch = halfWidth.match(/(令和|平成)(元|\d+)年/);
  if (eraMatch) {
    const year = eraToWesternYear(`${eraMatch[1]}${eraMatch[2]}年`);
    if (year) return year;
  }
  return 0;
}

/**
 * 指定年の会議一覧を取得する。
 * 一覧ページ → 年度別ページ → PDF リンクの順でクロールする。
 *
 * year=0 の場合はすべての年度を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<TobetsuMeeting[]> {
  const listHtml = await fetchPage(LIST_PAGE_URL);
  if (!listHtml) return [];

  const yearPageUrls = parseListPage(listHtml);
  const allMeetings: TobetsuMeeting[] = [];

  for (const url of yearPageUrls) {
    const pageHtml = await fetchPage(url);
    if (!pageHtml) continue;

    const pageYear = extractYearFromPageHtml(pageHtml);
    // year が指定されている場合、対象年度のみ処理する
    if (year !== 0 && pageYear !== 0 && pageYear !== year) continue;

    const meetings = parseYearPage(pageHtml, pageYear || year);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}

/**
 * PDF テキスト内のタイトル行から開催日を抽出する。
 *
 * パターン: "令和６年３月４日（月曜日）"（全角数字対応）
 */
export function parseDateFromPdfText(text: string): string | null {
  const halfWidth = toHalfWidth(text);
  const match = halfWidth.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(`${match[1]}${match[2]}年`);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
