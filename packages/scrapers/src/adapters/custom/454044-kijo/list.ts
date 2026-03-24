/**
 * 木城町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. トップページ (index.html) から年度別ページ URL を取得
 * 2. 年度別ページから会議録 PDF リンクとメタ情報を抽出
 *
 * HTML 構造（年度別ページ）:
 *   h4: 「第N回定例会」「第N回臨時会」
 *   h5: 「目次」「第1日」「第2日」...
 *   p.file-link-item > a.pdf: PDF リンク
 *
 * リンクテキスト例:
 *   「第2回定例会 会議録 3月8日 (PDFファイル: 615.3KB)」
 *   「第1回臨時会 目次 (PDFファイル: 68.7KB)」
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEraLabels } from "./shared";

export interface KijoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * トップページから年度別ページのリンクを抽出する。
 */
export function parseTopPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /gyouseizyouhou/gikai/kaigiroku/{ID}.html 形式のリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/gyouseizyouhou\/gikai\/kaigiroku\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    if (!label.includes("会議録")) continue;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * 年度別ページのリンクテキストから開催日（YYYY-MM-DD）を抽出する。
 *
 * テキスト例: "第2回定例会 会議録 3月8日 (PDFファイル: 615.3KB)"
 * → month=3, day=8
 *
 * 年は year パラメータから補完する。
 */
export function parseDateFromLinkText(
  text: string,
  year: number
): string | null {
  const match = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別ページのリンクテキストから会議セクション情報を抽出する。
 *
 * テキスト例: "第2回定例会 会議録 3月8日 (PDFファイル: 615.3KB)"
 * → section="第2回定例会"
 */
export function parseSectionFromLinkText(text: string): string | null {
  const match = text.match(/第(\d+)回(定例会|臨時会)/);
  if (!match) return null;
  return `第${match[1]}回${match[2]}`;
}

/**
 * 年度別ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * - 目次 PDF（リンクテキストに「目次」を含む）はスキップする
 * - p.file-link-item > a.pdf 形式のリンクが対象
 */
export function parseYearPage(html: string, year: number): KijoMeeting[] {
  const results: KijoMeeting[] = [];

  // a.pdf[href$=".pdf"] を抽出（プロトコル相対URLを含む）
  const linkRegex =
    /<a[^>]+class="pdf"[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次はスキップ
    if (rawText.includes("目次")) continue;

    const section = parseSectionFromLinkText(rawText);
    if (!section) continue;

    const heldOn = parseDateFromLinkText(rawText, year);
    if (!heldOn) continue;

    // プロトコル相対 URL を https に変換
    let pdfUrl: string;
    if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // 年の西暦から和暦タイトルを生成
    const eraTitle = buildEraTitle(year);
    const title = `${eraTitle}${section}`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      section,
    });
  }

  return results;
}

/**
 * 西暦年から和暦タイトルを生成する。
 * e.g., 2024 → "令和6年", 2019 → "令和元年"
 */
function buildEraTitle(year: number): string {
  if (year >= 2020) {
    return `令和${year - 2018}年`;
  } else if (year === 2019) {
    return "令和元年";
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    return eraYear === 1 ? "平成元年" : `平成${eraYear}年`;
  }
  return `${year}年`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<KijoMeeting[]> {
  // Step 1: トップページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraLabels = toJapaneseEraLabels(year);

  // 対象年度のページを見つける
  const targetPage = yearPages.find((p) =>
    eraLabels.some((label) => p.label.includes(label))
  );
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを抽出
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, year);
}
