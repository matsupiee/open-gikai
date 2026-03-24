/**
 * 志賀町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 会議録一覧ページ (list23-19.html) から年度別ページへのリンクを取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * PDF リンクは `/uploaded/attachment/{id}.pdf` 形式。
 * リンクテキストは「令和6年　3月12日（1日目） [PDFファイル／568KB]」形式。
 * セクション（定例会・臨時会）は <th> タグで区切られる。
 */

import { BASE_ORIGIN, fetchPage } from "./shared";

export interface ShikaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  session: string;
}

/**
 * 会議録一覧ページ (list23-19.html) から年度別ページの URL を抽出する。
 * リンクは `/site/gikai/{pageId}.html` 形式で、リンクテキストに和暦が含まれる。
 *
 * 実際の HTML 構造:
 *   <span class="article_title"><a href="/site/gikai/1079.html">令和6年 議会会議録</a></span>
 */
export function parseIndexPage(html: string): Array<{ url: string; year: number }> {
  const results: Array<{ url: string; year: number }> = [];
  // `/site/gikai/{id}.html` パターンのリンクを探す（テキストに令和/平成が含まれるもの）
  const linkPattern =
    /<a[^>]+href="(\/site\/gikai\/(\d+)\.html)"[^>]*>([^<]*(?:令和|平成)[^<]*(?:議会会議録|会議録)[^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[3]!.trim();
    // 「平成31年・令和元年」の場合は令和元年（2019）として扱う
    // まず令和から試す
    const reiwMatch = linkText.match(/令和(元|\d+)年/);
    if (reiwMatch) {
      const eraYear = reiwMatch[1] === "元" ? 1 : parseInt(reiwMatch[1]!, 10);
      const year = 2018 + eraYear;
      results.push({ url: `${BASE_ORIGIN}${href}`, year });
      continue;
    }
    // 平成のみの場合
    const heiMatch = linkText.match(/平成(元|\d+)年/);
    if (heiMatch) {
      const eraYear = heiMatch[1] === "元" ? 1 : parseInt(heiMatch[1]!, 10);
      const year = 1988 + eraYear;
      results.push({ url: `${BASE_ORIGIN}${href}`, year });
    }
  }

  return results;
}

/**
 * リンクテキストから開催日を YYYY-MM-DD 形式で返す。
 *
 * 対応パターン:
 *   "令和6年　3月12日（1日目） [PDFファイル／568KB]" -> 2024-03-12
 *   "令和6年　6月　4日（1日目）"                     -> 2024-06-04
 *   "令和6年3月12日"                                  -> 2024-03-12
 *   "03月12日（1日目）"                               -> YYYY-03-12
 */
export function parseDateFromText(text: string, year: number): string | null {
  // 「令和X年 M月 D日」パターン（全角スペースや複数スペース対応）
  const fullMatch = text.match(/(令和|平成)(元|\d+)年[\s　]*(\d{1,2})月[\s　]*(\d{1,2})日/);
  if (fullMatch) {
    const month = String(parseInt(fullMatch[3]!, 10)).padStart(2, "0");
    const day = String(parseInt(fullMatch[4]!, 10)).padStart(2, "0");
    const era = fullMatch[1]!;
    const eraYear = fullMatch[2] === "元" ? 1 : parseInt(fullMatch[2]!, 10);
    const resolvedYear = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
    return `${resolvedYear}-${month}-${day}`;
  }

  // 「MM月DD日」パターン（年度ページの短縮形式）
  const shortMatch = text.match(/(\d{1,2})月[\s　]*(\d{1,2})日/);
  if (shortMatch) {
    const month = String(parseInt(shortMatch[1]!, 10)).padStart(2, "0");
    const day = String(parseInt(shortMatch[2]!, 10)).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * リンクテキストからファイルサイズ情報等を除去して会議タイトルを生成する。
 * 例: "令和6年　3月12日（1日目） [PDFファイル／568KB]" -> "令和6年3月12日（1日目）"
 */
export function extractTitle(linkText: string): string {
  return linkText
    .replace(/\s*\[PDFファイル[^\]]*\]/g, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * セクション（第N回定例会・臨時会）は <th> タグで区切られる。
 * PDF リンクは <td> 内の <a href="/uploaded/attachment/{id}.pdf"> 形式。
 */
export function parseYearPage(html: string, year: number): ShikaMeeting[] {
  const results: ShikaMeeting[] = [];

  // HTML を行単位で走査してセクション名とPDFリンクを抽出
  // <th> タグにセクション名、<td> 内の <a> に PDF リンクがある
  let currentSession = "";

  // th タグまたは PDF リンクを順番に処理
  const combined = /<th[^>]*>([\s\S]*?)<\/th>|<a[^>]+href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(combined)) {
    if (match[1] !== undefined) {
      // <th> タグ: セクション名を更新
      const thText = match[1]!.replace(/<[^>]+>/g, "").trim();
      if (thText && (thText.includes("定例会") || thText.includes("臨時会"))) {
        currentSession = thText;
      }
    } else if (match[2] !== undefined) {
      // <a> タグ: PDF リンク
      const href = match[2]!;
      const linkText = match[3]!.trim();

      if (!linkText) continue;

      const pdfUrl = `${BASE_ORIGIN}${href}`;
      const title = extractTitle(linkText);
      const heldOn = parseDateFromText(linkText, year);

      results.push({
        pdfUrl,
        title,
        heldOn,
        session: currentSession,
      });
    }
  }

  return results;
}

/**
 * 年度別ページの URL を一覧ページから動的に取得し、指定年の全 PDF リンクを返す。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<ShikaMeeting[]> {
  // 一覧ページを取得して年度別ページ URL を収集
  const indexHtml = await fetchPage(baseUrl);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const targetPage = yearPages.find((p) => p.year === year);

  if (!targetPage) return [];

  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, year);
}
