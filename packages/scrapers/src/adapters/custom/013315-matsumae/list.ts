/**
 * 松前町議会（北海道） — list フェーズ
 *
 * 会議録一覧ページ（単一ページに全年度分）から PDF リンクを収集し、
 * 指定年に一致するものを返す。
 *
 * サイト構造:
 *   1ページに全年度の PDF リンクが掲載されている。
 *   リンクテキストから会議タイトルを取得し、ファイル名から年度を推定する。
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface MatsumaeMeeting {
  /** 会議タイトル（リンクテキスト） */
  title: string;
  /** 開催年（西暦。解析できない場合は null） */
  year: number | null;
  /** 開催日 YYYY-MM-DD（リンクテキストから解析できる場合のみ。通常は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_REQUEST_DELAY_MS = 1500;

// --- HTML パーサー（テスト用に export） ---

export interface PdfLinkInfo {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト */
  linkText: string;
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する。
 */
export function extractPdfLinks(html: string): PdfLinkInfo[] {
  const results: PdfLinkInfo[] = [];

  // href が .pdf で終わるリンクを抽出
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const rawText = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\(PDF[^)]*\)/gi, "")
      .trim();

    if (!href || !rawText) continue;

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    results.push({ pdfUrl, linkText: rawText });
  }

  return results;
}

/**
 * リンクテキストから年度情報を解析する。
 *
 * リンクテキスト例:
 *   "令和7年第1回定例会"
 *   "令和6年第1回臨時会"
 *   "令和6年予算審査特別委員会"
 *   "令和6年決算審査特別委員会"
 *   "令和元年第1回定例会"
 *   "平成25年第1回定例会"
 *
 * ファイル名からの年度推定（リンクテキストに年号がない場合のフォールバック）:
 *   "07_1tei_kaigiroku.pdf" → 令和07年（2025年）
 *   "31_1tei.pdf" → 平成31年（2019年）
 *   "01_1tei.pdf" → 令和01年（2019年）
 */
export function parseMeetingInfo(
  linkText: string,
  pdfUrl: string
): MatsumaeMeeting | null {
  if (!linkText || !pdfUrl) return null;

  const title = linkText.trim();
  const meetingType = detectMeetingType(title);

  // リンクテキストから和暦年を解析
  let year = parseWarekiYear(title);

  // リンクテキストに年号がない場合、ファイル名から年度を推定
  if (year === null) {
    const fileName = pdfUrl.split("/").pop() ?? "";
    year = guessYearFromFileName(fileName);
  }

  return {
    title,
    year,
    heldOn: null,
    pdfUrl,
    meetingType,
  };
}

/**
 * PDF ファイル名から年度（西暦）を推定する。
 *
 * パターン:
 *   "07_..." → 令和07年 = 2025
 *   "06_..." → 令和06年 = 2024
 *   "01_..." → 令和01年 = 2019
 *   "31_..." → 平成31年 = 2019（令和元年と同年）
 *   "30_..." → 平成30年 = 2018
 *   "29toku_..." → 平成29年 = 2017
 *   "28.1tei..." → 平成28年 = 2016
 *   "27teirei_01..." → 平成27年 = 2015
 *   "26teirei_01..." → 平成26年 = 2014
 *   "25_1tei..." → 平成25年 = 2013
 *
 * 判定ルール:
 *   先頭2桁の数字が 01〜31 の場合:
 *   - 01〜10 は令和（2019〜2028）
 *   - 25〜31 は平成（2013〜2019）
 *   - 11〜24 は範囲外（現時点では発生しない想定だが令和として扱う）
 */
export function guessYearFromFileName(fileName: string): number | null {
  const m = fileName.match(/^(\d{2})/);
  if (!m?.[1]) return null;

  const n = parseInt(m[1], 10);

  if (n >= 1 && n <= 24) {
    // 令和
    return 2018 + n;
  } else if (n >= 25 && n <= 31) {
    // 平成
    return 1988 + n;
  }

  return null;
}

/**
 * 一覧ページの HTML から指定年の会議情報を抽出する。
 */
export function parseMeetingList(
  html: string,
  year: number
): MatsumaeMeeting[] {
  const pdfLinks = extractPdfLinks(html);
  const results: MatsumaeMeeting[] = [];

  for (const { pdfUrl, linkText } of pdfLinks) {
    const meeting = parseMeetingInfo(linkText, pdfUrl);
    if (!meeting) continue;
    if (meeting.year !== year) continue;
    results.push(meeting);
  }

  return results;
}

/**
 * 指定年の会議リストを取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<MatsumaeMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  await delay(INTER_REQUEST_DELAY_MS);

  return parseMeetingList(html, year);
}
