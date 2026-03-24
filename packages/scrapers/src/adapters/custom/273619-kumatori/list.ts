/**
 * 熊取町議会 -- list フェーズ
 *
 * 年度別一覧ページから PDF リンクとメタ情報（リンクテキスト）を収集する。
 *
 * URL 構造:
 *   一覧トップ: /soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/index.html
 *   年度別ページ: /soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/{ページID}.html
 *   PDF: /material/files/group/30/{ファイル名}.pdf
 */

import { BASE_ORIGIN, YEAR_PAGE_IDS, fetchPage } from "./shared";

export interface KumatoriMeeting {
  pdfUrl: string;
  /** リンクテキスト（会議種別・日付情報を含む） */
  title: string;
  /** 開催日 YYYY-MM-DD（リンクテキストから推定可能な場合のみ） */
  heldOn: string | null;
  /** 会議セクション（定例会、委員会、全員協議会等） */
  section: string;
}

/**
 * 年度別一覧ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造（例）:
 *   <h3>3月定例会</h3>
 *   <ul>
 *     <li><a href="...pdf">本会議（○月○日、○日、○日、○日）</a></li>
 *     <li><a href="...pdf">議会運営委員会（○月○日）</a></li>
 *   </ul>
 *
 *   <h3>臨時会</h3>
 *   <ul>
 *     <li><a href="...pdf">本会議（○月○日）</a></li>
 *   </ul>
 *
 *   <h3>議員全員協議会</h3>
 *   <ul>
 *     <li><a href="...pdf">（○月○日）</a></li>
 *   </ul>
 */
export function parseYearPage(html: string, year: number): KumatoriMeeting[] {
  const results: KumatoriMeeting[] = [];

  // h2/h3 見出しの位置を収集
  const sections: { index: number; heading: string }[] = [];
  const headingPattern = /<h[23][^>]*>([^<]+)<\/h[23]>/g;
  for (const match of html.matchAll(headingPattern)) {
    const heading = match[1]!.trim();
    sections.push({ index: match.index!, heading });
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const pdfHref = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // /material/files/group/30/ 配下の PDF のみ対象
    if (!pdfHref.includes("/material/files/")) continue;

    // PDF の URL を絶対 URL に変換
    // href="//www.town.kumatori.lg.jp/..." のようなプロトコル相対 URL にも対応
    const pdfUrl = pdfHref.startsWith("http")
      ? pdfHref
      : pdfHref.startsWith("//")
        ? `https:${pdfHref}`
        : `${BASE_ORIGIN}${pdfHref.startsWith("/") ? "" : "/"}${pdfHref}`;

    // 現在のセクション見出しを特定（直前の h2/h3）
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.heading;
      }
    }

    // リンクテキストから日付を抽出
    const heldOn = parseDateFromLinkText(linkText, year);

    results.push({
      pdfUrl,
      title: `${currentSection} ${linkText}`.trim(),
      heldOn,
      section: currentSection,
    });
  }

  return results;
}

/**
 * リンクテキストから開催日（YYYY-MM-DD）を抽出する。
 * 熊取町は「（○月○日、○日、○日）」形式で複数日を表記することがある。
 * その場合、最初の日付を使用する。
 *
 * 例:
 *   "本会議（12月4日、5日、6日、17日）" → "2024-12-04"
 *   "議会運営委員会（12月3日）" → "2024-12-03"
 *   "（12月12日）" → "2024-12-12"
 *
 * @returns YYYY-MM-DD または null（解析できない場合）
 */
export function parseDateFromLinkText(
  text: string,
  year: number
): string | null {
  // パターン1: 「XX月YY日」形式
  const match = text.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<KumatoriMeeting[]> {
  const pageId = YEAR_PAGE_IDS[year];
  if (!pageId) {
    // 対応していない年度
    return [];
  }

  const yearPageUrl = `${BASE_ORIGIN}/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/${pageId}.html`;
  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, year);
}
