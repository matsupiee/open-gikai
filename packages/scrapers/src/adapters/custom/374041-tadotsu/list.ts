/**
 * 多度津町議会 — list フェーズ
 *
 * スクレイピング戦略:
 * 1. トップページ（index.html）から年度別ページの URL を動的取得
 * 2. 各年度ページから PDF リンク（material/files/group/13/*.pdf）を収集
 */

import { BASE_ORIGIN, fetchPage } from "./shared";

export interface TadotsuMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingName: string;
}

/**
 * トップページ HTML から年度別ページ URL を抽出する。
 *
 * HTML 構造: 会議録トップページに年度別ページへのリンクが並ぶ。
 * href は相対パス（例: /choseijoho/tadotsuchogikai/kaigiroku/3720.html）。
 *
 * 年度テキストは "令和7年（2025年）" または "平成25年（2013年）" のような形式。
 * 各リンクの西暦年をリンクテキストから抽出する。
 */
export function parseIndexPage(
  html: string
): { year: number; url: string }[] {
  const results: { year: number; url: string }[] = [];

  // 年度別ページへのリンクを抽出
  // パターン: <a href="/choseijoho/tadotsuchogikai/kaigiroku/XXXX.html">令和N年（YYYY年）会議録</a>
  const linkPattern =
    /<a[^>]+href="([^"]*\/kaigiroku\/\d+\.html)"[^>]*>\s*([^<]*)\s*<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // 西暦年を抽出: "令和7年（2025年）" → 2025
    const yearMatch = linkText.match(/[（(](\d{4})年[）)]/);
    if (!yearMatch) continue;

    const year = parseInt(yearMatch[1]!, 10);
    const url = href.startsWith("http")
      ? href.replace(/^http:\/\//, "https://")
      : `${BASE_ORIGIN}${href}`;

    results.push({ year, url });
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 *
 * PDF は material/files/group/13/*.pdf のパターン。
 * リンクテキストをタイトルとして使用する。
 */
export function parseYearPage(
  html: string,
  year: number
): { pdfUrl: string; title: string }[] {
  const results: { pdfUrl: string; title: string }[] = [];

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*material\/files\/group\/\d+\/[^"]+\.pdf)"[^>]*>\s*([^<]*)\s*<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    const pdfUrl = href.startsWith("http")
      ? href.replace(/^http:\/\//, "https://")
      : `${BASE_ORIGIN}${href}`;

    results.push({
      pdfUrl,
      title: linkText || `${year}年 会議録`,
    });
  }

  return results;
}

/**
 * PDF タイトルテキストから会議種別を判定する。
 */
export function detectMeetingName(title: string): string {
  if (title.includes("臨時")) return "臨時会";
  if (title.includes("一般質問")) {
    // 定例会の回数を特定しようとする
    const match = title.match(/第(\d)回/);
    if (match) return `第${match[1]}回定例会`;
    return "定例会 一般質問";
  }
  const match = title.match(/第(\d)回/);
  if (match) return `第${match[1]}回定例会`;
  return "定例会";
}

/**
 * PDF タイトルと年から heldOn (YYYY-MM-DD) を推定する。
 *
 * 多度津町の定例会スケジュール（推定）:
 * - 第1回定例会: 3月
 * - 第2回定例会: 6月
 * - 第3回定例会: 9月
 * - 第4回定例会: 12月
 * - 臨時会: 年間随時
 */
export function estimateHeldOn(title: string, year: number): string {
  // ファイル名から月を抽出（ファイル名パターン: 0712xxx.pdf → 07月, 12月）
  // タイトルテキストから月を直接抽出
  const monthMatch = title.match(/(\d{1,2})月/);
  if (monthMatch) {
    const month = parseInt(monthMatch[1]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  // 回数から月を推定
  const match = title.match(/第(\d)回/);
  if (match) {
    const sessionNum = parseInt(match[1]!, 10);
    const monthMap: Record<number, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };
    const month = monthMap[sessionNum] ?? 6;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  // 臨時会は年の半ばとして推定
  if (title.includes("臨時")) {
    return `${year}-06-01`;
  }

  return `${year}-01-01`;
}

/**
 * 指定年度の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<TadotsuMeeting[]> {
  // Step 1: トップページから年度別ページ URL を収集
  const indexHtml = await fetchPage(baseUrl);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);

  // 対象年度のページを選択
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを収集
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  const pdfLinks = parseYearPage(yearHtml, year);

  return pdfLinks.map((link) => {
    const meetingName = detectMeetingName(link.title);
    const heldOn = estimateHeldOn(link.title, year);

    return {
      pdfUrl: link.pdfUrl,
      title: link.title,
      heldOn,
      meetingName,
    };
  });
}
