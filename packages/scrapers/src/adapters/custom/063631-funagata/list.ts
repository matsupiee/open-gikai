/**
 * 舟形町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 一覧ページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * トップページ構造:
 *   <li><a href="../../../s027/gikai/010/150/20250328112359.html">令和7年 議事録</a></li>
 *
 * 年度別ページ構造:
 *   <h2>第4回 定例会</h2>
 *   <h3>12月3日から12月5日</h3>
 *   <p><a href="./r7-04teirei-12.3-12.5_2.pdf" title="令和7年第4回定例会">令和7年第4回定例会</a></p>
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface FunagataMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string; // YYYY-MM-DD
  section: string; // e.g., "第4回 定例会"
}

/**
 * 一覧ページから年度別ページのリンクを抽出する。
 */
export function parseTopPage(
  html: string,
  baseUrl: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // リンクパターン: <a href="..."><span class="inner">令和7年 議事録</span></a>
  // リンクテキストが <span> で囲まれているケースにも対応
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawLabel = match[2]!.replace(/<[^>]+>/g, "").trim();
    if (!rawLabel.includes("議事録")) continue;
    const label = rawLabel;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス（../../../s027/...）を解決
      url = new URL(href, baseUrl).href;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * h3 の日付テキストから YYYY-MM-DD を返す。
 *
 * 対応パターン:
 *   "12月3日から12月5日" → 最初の日付 "12月3日" を使用
 *   "10月8日" → そのまま使用
 *
 * 年は yearContext（年度別ページから取得した西暦年）を使う。
 */
export function parseDateFromH3(
  h3Text: string,
  yearContext: number
): string | null {
  const match = h3Text.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  return `${yearContext}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別ページのリンクテキストから西暦年を推定する。
 * e.g., "令和7年 議事録" → 2025, "平成30年 議事録" → 2018
 */
export function extractYearFromLabel(label: string): number | null {
  const reiwaMatch = label.match(/令和(\d+)年/);
  if (reiwaMatch) return parseInt(reiwaMatch[1]!, 10) + 2018;

  if (label.includes("令和元年")) return 2019;

  const heiseiMatch = label.match(/平成(\d+)年/);
  if (heiseiMatch) return parseInt(heiseiMatch[1]!, 10) + 1988;

  if (label.includes("平成元年")) return 1989;

  return null;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 *   <h2>第4回 定例会</h2>
 *   <h3>12月3日から12月5日</h3>
 *   <p><a href="./r7-04teirei-12.3-12.5_2.pdf" title="...">令和7年第4回定例会</a></p>
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
  yearContext: number
): FunagataMeeting[] {
  const results: FunagataMeeting[] = [];

  // h2 セクション見出しを収集（例: "第4回 定例会", "第3回 臨時会"）
  const h2Sections: { index: number; name: string }[] = [];
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
  for (const match of html.matchAll(h2Pattern)) {
    h2Sections.push({
      index: match.index!,
      name: match[1]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // h3 日付見出しを収集（例: "12月3日から12月5日", "10月8日"）
  const h3Dates: { index: number; text: string }[] = [];
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
  for (const match of html.matchAll(h3Pattern)) {
    h3Dates.push({
      index: match.index!,
      text: match[1]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  const baseDir = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 現在の h2 セクションを特定
    let currentSection = "";
    for (const section of h2Sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // 直前の h3 日付を特定
    let h3Text = "";
    for (const h3 of h3Dates) {
      if (h3.index < linkIndex) {
        h3Text = h3.text;
      }
    }

    // h3 の日付テキストから開催日を抽出
    const heldOn = parseDateFromH3(h3Text, yearContext);
    if (!heldOn) continue;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("./")) {
      pdfUrl = baseDir + href.slice(2);
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = baseDir + href;
    }

    // タイトルはリンクテキストをそのまま使用
    const title = linkText || currentSection;

    results.push({ pdfUrl, title, heldOn, section: currentSection });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<FunagataMeeting[]> {
  // Step 1: 一覧ページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml, baseUrl);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPage = yearPages.find((p) =>
    eraTexts.some((era) => p.label.includes(era))
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.url, year);
}
