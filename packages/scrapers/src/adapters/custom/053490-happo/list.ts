/**
 * 八峰町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. 会議録トップページから対象年度のページ URL を取得
 * 2. 年度別ページから PDF リンクとメタ情報を抽出
 *
 * 近年のページでは「全ページ版」「日程別」「一般質問抜粋」など複数 PDF に分かれている。
 * 「全ページ版」（会議録）を優先し、日程別・一般質問抜粋はスキップする。
 */

import { BASE_ORIGIN, YEAR_PAGE_MAP, fetchPage } from "./shared";

export interface HappoMeeting {
  pdfUrl: string;
  title: string;
  section: string;
}

/**
 * 会議録トップページから年度別ページのリンクを抽出する。
 * リンクテキスト例: "八峰町議会議事録2025年（令和7年）"
 */
export function parseTopPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /archive/ を含むリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/archive\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!label.includes("議事録") && !label.includes("会議録")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url });
  }

  return results;
}

/**
 * リンクテキストまたは年度ページラベルから西暦年を抽出する。
 * 例: "八峰町議会議事録2025年（令和7年）" → 2025
 */
export function extractYearFromLabel(label: string): number | null {
  const match = label.match(/(20\d{2})年/);
  return match ? parseInt(match[1]!, 10) : null;
}

/**
 * PDF リンクが「全ページ版」（会議録本体）かどうかを判定する。
 * 日程別（１日目、２日目...）や一般質問抜粋（○○議員一般質問部分）はスキップ対象。
 */
export function isFullRecord(linkText: string, fileName: string): boolean {
  // 日程別は除外: "１日目", "２日目", "1日目" etc.
  if (/[０-９\d]+日目/.test(linkText) || /[０-９\d]+日目/.test(fileName)) {
    return false;
  }

  // 一般質問抜粋は除外
  if (
    linkText.includes("一般質問") ||
    fileName.includes("一般質問")
  ) {
    return false;
  }

  return true;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - <h3>令和７年９月議会定例会</h3> でセクション分け
 * - <a href="/uploads/public/archive_.../xxx.pdf">リンクテキスト</a> で PDF リンク
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): HappoMeeting[] {
  const results: HappoMeeting[] = [];

  // セクション見出しの位置を収集（h3, h2, h4 タグ）
  const sections: { index: number; name: string }[] = [];
  const headingPattern = /<h[234][^>]*>([\s\S]*?)<\/h[234]>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    if (text.includes("定例") || text.includes("臨時")) {
      sections.push({ index: match.index!, name: text });
    }
  }

  sections.sort((a, b) => a.index - b.index);

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // pageUrl からベース URL を構築
  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("./")) {
      pdfUrl = baseUrl + href.slice(2);
    } else {
      pdfUrl = baseUrl + href;
    }

    // ファイル名を取得
    const fileName = decodeURIComponent(pdfUrl.split("/").pop() ?? "");

    // 全ページ版のみ取得（日程別・一般質問抜粋はスキップ）
    if (!isFullRecord(linkText, fileName)) continue;

    // タイトルを構築
    const title = currentSection || linkText.replace(/[\[［].*?[\]］]/g, "").trim();

    results.push({ pdfUrl, title, section: currentSection });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HappoMeeting[]> {
  // Step 1: トップページから年度別ページの URL を取得
  const topHtml = await fetchPage(baseUrl);
  let yearPageUrl: string | null = null;

  if (topHtml) {
    const yearPages = parseTopPage(topHtml);
    const targetPage = yearPages.find((p) => {
      const y = extractYearFromLabel(p.label);
      return y === year;
    });
    if (targetPage) {
      yearPageUrl = targetPage.url;
    }
  }

  // フォールバック: 固定マッピングから URL を取得
  if (!yearPageUrl) {
    const path = YEAR_PAGE_MAP[year];
    if (!path) return [];
    yearPageUrl = `${BASE_ORIGIN}${path}`;
  }

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, yearPageUrl);
}
