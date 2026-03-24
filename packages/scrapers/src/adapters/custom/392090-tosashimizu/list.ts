/**
 * 土佐清水市議会 — list フェーズ
 *
 * 一覧ページ（042.html）から詳細ページへのリンクを収集し、
 * 各詳細ページから PDF URL とメタ情報を抽出する。
 *
 * ページ構造:
 * - 一覧ページ（042.html）にページネーションなしで全95件が掲載されている
 * - 各詳細ページ（/kurashi/section/gikai/{ID}.html）に複数の PDF リンクがある
 * - 新形式: /kurashi/section/gikai/{5桁前後の数値}.html
 * - 旧形式: /kurashi/section/gikai/{3桁連番}.html
 */

import { BASE_ORIGIN, LIST_URL, eraToWesternYear, normalizeDigits, fetchPage } from "./shared";

export interface TosashimizuMeeting {
  /** PDF ファイルの URL */
  pdfUrl: string;
  /** PDF のリンクテキスト（例: "令和7年6月会議 開会日"） */
  title: string;
  /** 会議タイトル（詳細ページから取得: 例: "令和7年定例会6月会議"） */
  meetingTitle: string;
  /** 詳細ページの URL */
  detailUrl: string;
}

/**
 * 一覧ページの HTML から詳細ページへのリンクを抽出する（テスト可能な純粋関数）。
 *
 * - href が /kurashi/section/gikai/{数値}.html のリンクを抽出
 * - 042.html 自身はスキップ
 * - 重複を除去して返す
 */
export function parseListPage(html: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  // href="/kurashi/section/gikai/{数値}.html" または絶対URLのパターン
  const linkPattern = /href="([^"]*\/kurashi\/section\/gikai\/(\d+)\.html)"/g;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const id = match[2]!;

    // 042 (一覧ページ自身) はスキップ
    if (id === "042") continue;

    // 絶対URLか相対パスかを判定してURLを構築
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/kurashi/section/gikai/${id}.html`;
    }

    if (!seen.has(url)) {
      seen.add(url);
      results.push(url);
    }
  }

  return results;
}

/**
 * 詳細ページの HTML から会議タイトルを抽出する（テスト可能な純粋関数）。
 *
 * h1 または h2 タグから会議名を取得する。
 */
export function parseMeetingTitleFromDetailPage(html: string): string {
  // タグを除去してテキストを取得する
  const cleanText = (raw: string) =>
    raw
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[\s　]+/g, " ")
      .trim();

  // h1 タグから取得
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const text = cleanText(h1Match[1]!);
    if (text && text.includes("会議")) return text;
  }

  // h2 タグから取得
  const h2Matches = html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  for (const match of h2Matches) {
    const text = cleanText(match[1]!);
    if (text && text.includes("会議")) return text;
  }

  // title タグから取得
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const text = cleanText(titleMatch[1]!);
    return text;
  }

  return "";
}

/**
 * 詳細ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * - href が .pdf で終わるリンクを抽出
 * - PDF URL は /fs/ 配下
 */
export function parseDetailPage(
  html: string,
  detailUrl: string,
  meetingTitle: string
): TosashimizuMeeting[] {
  const results: TosashimizuMeeting[] = [];

  // a[href$=".pdf"] を抽出
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkHtml = match[2]!;
    const linkText = linkHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[\s　]+/g, " ")
      .trim();

    if (!linkText) continue;

    // PDF URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      const base = detailUrl.replace(/\/[^/]+$/, "/");
      pdfUrl = base + href;
    }

    results.push({
      pdfUrl,
      title: linkText,
      meetingTitle,
      detailUrl,
    });
  }

  return results;
}

/**
 * PDF テキストの冒頭から開催日（YYYY-MM-DD）を抽出する。
 *
 * 土佐清水市の会議録 PDF には「令和X年X月X日」または「平成X年X月X日」の形式で日付が記載される。
 * 全角数字（２月２５日 等）にも対応する。
 */
export function parseMeetingDateFromText(text: string): string | null {
  // 全角数字を半角に変換してから検索する
  const normalized = normalizeDigits(text.replace(/[\s　]+/g, " ")).trim();

  // 「令和X年X月X日」または「平成X年X月X日」パターン
  const eraMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const [, era, eraYearStr, monthStr, dayStr] = eraMatch;
    const westernYear = eraToWesternYear(era!, eraYearStr!);
    if (!westernYear) return null;
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 会議タイトルから年を抽出して西暦に変換する。
 * 開催日が PDF から取得できない場合のフォールバック用。
 *
 * e.g., "令和7年6月会議" → 2025
 */
export function parseYearFromTitle(title: string): number | null {
  const normalized = normalizeDigits(title);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 指定年の全会議 PDF リストを取得する。
 *
 * 1. 一覧ページから詳細ページ URL を収集
 * 2. 各詳細ページから PDF リンクを収集
 * 3. 年フィルタリング（会議タイトルまたは PDF リンクテキストから年を判定）
 */
export async function fetchMeetingList(year: number): Promise<TosashimizuMeeting[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const detailUrls = parseListPage(listHtml);
  const results: TosashimizuMeeting[] = [];

  for (const detailUrl of detailUrls) {
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const meetingTitle = parseMeetingTitleFromDetailPage(detailHtml);
    const titleYear = parseYearFromTitle(meetingTitle);

    // 年フィルタリング: タイトルから年が判定できる場合のみ対象年に絞り込む
    if (titleYear !== null && titleYear !== year) continue;

    const meetings = parseDetailPage(detailHtml, detailUrl, meetingTitle);
    results.push(...meetings);

    // レート制限
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
