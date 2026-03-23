/**
 * 一宮町議会 -- list フェーズ
 *
 * 年度別一覧ページから PDF リンクを抽出し、
 * セッション情報のリストを返す。
 *
 * 各年度ページには当該年度の全会議録 PDF リンクが掲載されている。
 * ページネーションはない。
 */

import { BASE_ORIGIN, YEAR_PAGE_MAP, detectMeetingType, fetchPage, delay } from "./shared";

export interface IchinomiyaSessionInfo {
  /** 会議タイトル（例: "令和６年第４回定例会"） */
  title: string;
  /** 開催年（西暦） */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** ページ URL（参照元） */
  pageUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッション情報を収集する。
 * YEAR_PAGE_MAP に定義された年度ページから PDF リンクを抽出する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<IchinomiyaSessionInfo[]> {
  const pageUrl = YEAR_PAGE_MAP[year];
  if (!pageUrl) return [];

  await delay(INTER_PAGE_DELAY_MS);

  const html = await fetchPage(pageUrl);
  if (!html) return [];

  return extractPdfRecords(html, year, pageUrl);
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * リンク形式例:
 *   <a href="/assets/files/gikai/R6.9kaigiroku.pdf">令和６年第４回定例会</a>
 *   <a href="/assets/files/gikai/20240529.pdf">令和６年第２回定例会</a>
 */
export function extractPdfRecords(
  html: string,
  year: number,
  pageUrl: string
): IchinomiyaSessionInfo[] {
  const records: IchinomiyaSessionInfo[] = [];
  const seen = new Set<string>();

  // PDF リンクを抽出（相対・絶対 URL 両方対応）
  const pdfPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();

    // PDF 絶対 URL を構築
    const absoluteUrl = href.startsWith("http")
      ? href
      : new URL(href, BASE_ORIGIN).toString();

    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);

    const meetingType = detectMeetingType(linkText);

    records.push({
      title: linkText,
      year,
      pdfUrl: absoluteUrl,
      meetingType,
      pageUrl,
    });
  }

  return records;
}
