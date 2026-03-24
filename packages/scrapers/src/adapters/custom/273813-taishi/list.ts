/**
 * 太子町議会 -- list フェーズ
 *
 * 年度別一覧ページから PDF リンクとメタ情報（リンクテキスト）を収集する。
 *
 * URL 構造:
 *   一覧トップ: /busyo/gikai_jimu/taishichougikai/kaigirokunoetsuran/index.html
 *   年度別ページ: /busyo/gikai_jimu/taishichougikai/kaigirokunoetsuran/{ページID}.html
 *   PDF: //www.town.taishi.osaka.jp/material/files/group/6/{ファイル名}.pdf
 *
 * HTML 構造:
 *   h2: 本会議
 *     ul > li > a[href$=".pdf"] リンクテキスト: "令和6年第4回定例会 会議録"
 *   h2: 常任委員会
 *     h3: 総務まちづくり常任委員会
 *       ul > li > a[href$=".pdf"] リンクテキスト: "令和6年12月12日 総務まちづくり常任委員会 会議録"
 *     h3: 福祉文教常任委員会
 *       ...
 */

import { BASE_ORIGIN, YEAR_PAGE_IDS, fetchPage } from "./shared";

export interface TaishiMeeting {
  pdfUrl: string;
  /** リンクテキスト（会議種別・日付情報を含む） */
  title: string;
  /** 開催日 YYYY-MM-DD（リンクテキストから推定可能な場合のみ） */
  heldOn: string | null;
  /** 会議セクション（本会議、常任委員会名等） */
  section: string;
}

/**
 * 本会議のリンクテキストから年・回・種別を取得する。
 *
 * 対応パターン:
 *   "令和6年第4回定例会 会議録"
 *   "令和6年第1回臨時会 会議録"
 *   "平成31年第1回定例会 会議録"
 *
 * @returns YYYY-MM-DD 形式の日付（推定不可の場合は null）
 */
export function parseDateFromHonkaigiText(
  text: string,
  year: number
): string | null {
  // 本会議はリンクテキストから正確な日付が取得できないため null を返す
  // 日付情報（月日）がリンクテキストに含まれていないため
  void text;
  void year;
  return null;
}

/**
 * 委員会のリンクテキストから日付を抽出する。
 *
 * 対応パターン:
 *   "令和6年12月12日 総務まちづくり常任委員会 会議録"
 *   "令和7年6月4日 総務まちづくり常任委員会 会議録"
 *
 * @returns YYYY-MM-DD または null
 */
export function parseDateFromIinkaiText(
  text: string,
  _year: number
): string | null {
  // 令和X年MM月DD日 パターン
  const reiwaMatch = text.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (reiwaMatch) {
    const reiwaYear = Number(reiwaMatch[1]);
    const month = Number(reiwaMatch[2]);
    const day = Number(reiwaMatch[3]);
    const westernYear = 2018 + reiwaYear;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 平成X年MM月DD日 パターン
  const heiseiMatch = text.match(/平成(\d+)年(\d+)月(\d+)日/);
  if (heiseiMatch) {
    const heiseiYear = Number(heiseiMatch[1]);
    const month = Number(heiseiMatch[2]);
    const day = Number(heiseiMatch[3]);
    const westernYear = 1988 + heiseiYear;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 年度別一覧ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   h2: 本会議
 *     ul > li > a[href$=".pdf"]
 *   h2: 常任委員会
 *     h3: 総務まちづくり常任委員会
 *       ul > li > a[href$=".pdf"]
 */
export function parseYearPage(html: string, year: number): TaishiMeeting[] {
  const results: TaishiMeeting[] = [];

  // h2/h3 見出しの位置を収集
  const sections: { index: number; heading: string; level: number }[] = [];
  const headingPattern = /<h([23])[^>]*>([\s\S]*?)<\/h[23]>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const level = Number(match[1]);
    const heading = match[2]!.replace(/<[^>]+>/g, "").trim();
    sections.push({ index: match.index!, heading, level });
  }

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const pdfHref = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // /material/files/ 配下の PDF のみ対象
    if (!pdfHref.includes("/material/files/")) continue;

    // PDF の URL を絶対 URL に変換
    // href="//www.town.taishi.osaka.jp/..." のようなプロトコル相対 URL にも対応
    const pdfUrl = pdfHref.startsWith("http")
      ? pdfHref
      : pdfHref.startsWith("//")
        ? `https:${pdfHref}`
        : `${BASE_ORIGIN}${pdfHref.startsWith("/") ? "" : "/"}${pdfHref}`;

    // 現在のセクション見出しを特定
    // h3 があればそちらを優先（委員会名）、なければ h2（本会議 / 常任委員会）
    let currentH2 = "";
    let currentH3 = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        if (section.level === 2) {
          currentH2 = section.heading;
          currentH3 = ""; // h2 が変わったら h3 をリセット
        } else if (section.level === 3) {
          currentH3 = section.heading;
        }
      }
    }

    const section = currentH3 || currentH2;

    // 日付を抽出: h3 配下（委員会）はリンクテキストから、h2 配下（本会議）は null
    const heldOn =
      currentH3
        ? parseDateFromIinkaiText(linkText, year)
        : parseDateFromHonkaigiText(linkText, year);

    results.push({
      pdfUrl,
      title: linkText,
      heldOn,
      section,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<TaishiMeeting[]> {
  const pageId = YEAR_PAGE_IDS[year];
  if (!pageId) {
    return [];
  }

  const yearPageUrl = `${BASE_ORIGIN}/busyo/gikai_jimu/taishichougikai/kaigirokunoetsuran/${pageId}.html`;
  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, year);
}
