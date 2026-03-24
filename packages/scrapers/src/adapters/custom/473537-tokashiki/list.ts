/**
 * 渡嘉敷村議会 会議録 — list フェーズ
 *
 * 年度別一覧ページ → 個別ページ → PDF リンクの順でクロールする。
 *
 * 年度別一覧ページ構造:
 *   <ul>/<li> のリスト構造で会議リンクを表示
 *   リンクテキストに「会議録」を含むページのみを対象とする
 *
 * 個別ページ構造:
 *   PDF ファイルへのダウンロードリンクを 1 つ含む
 *   リンク形式: //www.vill.tokashiki.okinawa.jp/material/files/group/7/{ファイル名}.pdf
 */

import {
  BASE_ORIGIN,
  YEAR_PATHS,
  buildYearListUrl,
  eraToWesternYear,
  fetchPage,
  normalizeUrl,
  toHalfWidth,
} from "./shared";

export interface TokashikiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第7回定例会 会議録"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary"） */
  category: string;
  /** 外部 ID 用のキー（例: "473537_reiwa7_12kaigiroku"） */
  pdfKey: string;
}

/**
 * 年度別一覧ページの HTML から「会議録」を含む個別ページ URL を抽出する。
 */
export function parseYearListPage(html: string, baseUrl: string): string[] {
  const urls: string[] = [];

  // <a> タグから href とリンクテキストを抽出
  const linkPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストに「会議録」を含む場合のみ対象
    if (!linkText.includes("会議録")) continue;

    // .pdf リンクは除外（直接 PDF リンクは個別ページ処理で扱う）
    if (href.endsWith(".pdf")) continue;

    const absoluteUrl = resolveUrl(href, baseUrl);
    if (absoluteUrl && !urls.includes(absoluteUrl)) {
      urls.push(absoluteUrl);
    }
  }

  return urls;
}

/**
 * 個別ページの HTML から PDF URL を抽出する。
 */
export function parseDetailPage(
  html: string,
): { pdfUrl: string; pdfKey: string } | null {
  // <a> タグから .pdf で終わるリンクを抽出
  const pdfPattern = /<a\s+[^>]*href="([^"]+\.pdf)"[^>]*>/gi;
  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    const pdfUrl = normalizeUrl(href);
    const pdfKey = extractPdfKey(pdfUrl);
    return { pdfUrl, pdfKey };
  }

  return null;
}

/**
 * PDF URL からキーを生成する。
 * e.g., ".../reiwa7_12kaigiroku.pdf" → "473537_reiwa7_12kaigiroku"
 */
function extractPdfKey(pdfUrl: string): string {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  const fileName = match ? match[1]! : pdfUrl;
  return `473537_${fileName}`;
}

/**
 * 個別ページの HTML からタイトルを抽出する。
 */
export function parseTitleFromDetailPage(html: string): string {
  // <h1> または <h2> タグからタイトルを抽出
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const text = h1Match[1]!.replace(/<[^>]+>/g, "").trim();
    if (text) return text;
  }

  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Match) {
    const text = h2Match[1]!.replace(/<[^>]+>/g, "").trim();
    if (text) return text;
  }

  // <title> タグから抽出
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const text = titleMatch[1]!.replace(/<[^>]+>/g, "").trim();
    if (text) return text;
  }

  return "";
}

/**
 * タイトルから開催年の候補を抽出する（和暦 → 西暦）。
 */
export function parseYearFromTitle(title: string): number | null {
  const halfWidth = toHalfWidth(title);
  const match = halfWidth.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(`${match[1]}${match[2]}年`);
}

/**
 * タイトルから会議種別（plenary / extraordinary）を判別する。
 */
export function detectCategoryFromTitle(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 相対 URL を絶対 URL に変換する。
 */
function resolveUrl(href: string, baseUrl: string): string | null {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;

  // 相対パスを解決
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(href, base);
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * 指定年の会議一覧を取得する。
 * 年度別一覧 → 個別ページ → PDF の順でクロールする。
 */
export async function fetchMeetingList(
  year: number,
): Promise<TokashikiMeeting[]> {
  const yearPathEntry = YEAR_PATHS.find((p) => p.westernYear === year);
  if (!yearPathEntry) return [];

  const yearListUrl = buildYearListUrl(yearPathEntry.path);
  const yearHtml = await fetchPage(yearListUrl);
  if (!yearHtml) return [];

  const detailUrls = parseYearListPage(yearHtml, yearListUrl);
  const allMeetings: TokashikiMeeting[] = [];

  for (const detailUrl of detailUrls) {
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const pdfInfo = parseDetailPage(detailHtml);
    if (!pdfInfo) continue;

    const rawTitle = parseTitleFromDetailPage(detailHtml);
    const category = detectCategoryFromTitle(rawTitle);

    allMeetings.push({
      pdfUrl: pdfInfo.pdfUrl,
      title: rawTitle || detailUrl,
      heldOn: null, // 開催日は PDF テキストから取得
      category,
      pdfKey: pdfInfo.pdfKey,
    });

    // レート制限: リクエスト間に 1 秒の待機
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return allMeetings;
}
