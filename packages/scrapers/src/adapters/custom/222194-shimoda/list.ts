/**
 * 下田市議会 — list フェーズ
 *
 * 2 つの一覧ページから会期ページ URL を収集し、各会期ページから会議録本文 PDF
 * リンクを抽出する:
 * - https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/index.html（令和元年度以降）
 * - https://www.city.shimoda.shizuoka.jp/category/h28_kaigiroku/index.html（平成31年度以前）
 *
 * HTML 構造:
 * - 一覧ページ: 各会期ページへのリンク（category/{ID}.html 形式）
 * - 会期ページ: 各日程の PDF リンクが掲載（リンクテキストに「会議録本文」を含む）
 *
 * PDF ファイル名パターン:
 *   会議録本文（YYMMDD）.pdf
 *   ファイル名の括弧内は「YYMMDD」形式（例: 061205 = 令和6年12月5日）
 */

import {
  BASE_ORIGIN,
  REIWA_LIST_PATH,
  HEISEI_LIST_PATH,
  fetchPage,
} from "./shared";

export interface ShimodaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * YYMMDD 形式の文字列（和暦）から YYYY-MM-DD 形式に変換する。
 * 下田市のPDFファイル名は令和を基準とする。
 * e.g., "061205" → 令和6年12月5日 → "2024-12-05"
 *       "010901" → 令和元年9月1日 → "2019-09-01"
 */
export function parseWarekiDateCode(code: string): string | null {
  const match = code.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;

  const reiwaYear = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  if (reiwaYear < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const westernYear = reiwaYear + 2018;
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD 形式に変換する。
 * e.g., "令和7年12月3日" → "2025-12-03"
 *       "令和元年6月10日" → "2019-06-10"
 *       "平成31年3月15日" → "2019-03-15"
 */
export function parseJapaneseDate(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearRaw, month, day] = match;
  const eraYear = eraYearRaw === "元" ? 1 : Number(eraYearRaw);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}

/**
 * 会期ページのリンクテキスト（会期名）から会議の種類と年度情報を抽出する。
 * e.g., "令和7年12月定例会" → { section: "12月定例会", title: "令和7年12月定例会" }
 *       "令和6年1月臨時会" → { section: "1月臨時会", title: "令和6年1月臨時会" }
 */
export function parseSessionTitle(text: string): {
  section: string;
  title: string;
  year: number | null;
} | null {
  const match = text.match(/(令和|平成)(元|\d+)年(.+)/);
  if (!match) return null;

  const [, era, eraYearRaw, rest] = match;
  const eraYear = eraYearRaw === "元" ? 1 : Number(eraYearRaw);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  const section = rest!.trim();
  const title = `${era}${eraYearRaw}年${section}`;

  return { section, title, year: westernYear };
}

/**
 * 一覧ページの HTML から会期ページへのリンクを抽出する。
 * category/090100kaigiroku/{ID}.html および category/h28_kaigiroku/{ID}.html 形式のリンクを抽出。
 */
export function parseSessionLinks(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a[^>]+href="([^"]*category\/(?:090100kaigiroku|h28_kaigiroku)\/\d+\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 会期ページの HTML から会議録本文 PDF リンクを抽出する。
 * リンクテキストに「会議録本文」を含む /file/ のリンクを対象とする。
 */
export function parseSessionPage(
  html: string,
  sessionTitle: string,
  sessionSection: string,
  targetYear: number
): ShimodaMeeting[] {
  const results: ShimodaMeeting[] = [];

  // /file/ パスの PDF リンクを抽出
  const linkRegex = /<a[^>]+href="([^"]*\/file\/[^"]*\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawLinkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストに「会議録本文」が含まれるものだけを対象とする
    if (!rawLinkText.includes("会議録本文")) continue;

    // URL の末尾に余分な空白が混入している場合は除去
    const cleanHref = href.trim();

    // 絶対 URL に変換
    let pdfUrl: string;
    if (cleanHref.startsWith("http")) {
      pdfUrl = cleanHref;
    } else if (cleanHref.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${cleanHref}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${cleanHref}`;
    }

    // ファイル名から日付を抽出: 会議録本文（YYMMDD）.pdf
    const decodedHref = decodeURIComponent(cleanHref);
    const dateMatch = decodedHref.match(/会議録本文[（(](\d{6})[）)]/);

    let heldOn: string | null = null;
    if (dateMatch) {
      heldOn = parseWarekiDateCode(dateMatch[1]!);
    }

    if (!heldOn) continue;

    // 年度フィルタリング
    const heldYear = parseInt(heldOn.slice(0, 4), 10);
    if (heldYear !== targetYear) continue;

    // URL エンコードが必要な場合は encodeURI で処理
    let encodedPdfUrl: string;
    try {
      // すでにエンコードされているか確認
      const decoded = decodeURIComponent(pdfUrl);
      encodedPdfUrl = encodeURI(decoded);
    } catch {
      encodedPdfUrl = encodeURI(pdfUrl);
    }

    results.push({
      pdfUrl: encodedPdfUrl,
      title: sessionTitle,
      heldOn,
      section: sessionSection,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 令和元年度以降・平成31年度以前の 2 つの一覧ページから会期ページ URL を収集し、
 * 各会期ページから会議録本文 PDF リンクを抽出する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<ShimodaMeeting[]> {
  const results: ShimodaMeeting[] = [];
  const allSessionUrls: string[] = [];

  // 令和元年度以降の一覧ページ
  const reiwaListUrl = `${BASE_ORIGIN}${REIWA_LIST_PATH}`;
  const reiwaHtml = await fetchPage(reiwaListUrl);
  if (reiwaHtml) {
    allSessionUrls.push(...parseSessionLinks(reiwaHtml));
  }

  // 平成31年度以前の一覧ページ
  const heiseiListUrl = `${BASE_ORIGIN}${HEISEI_LIST_PATH}`;
  const heiseiHtml = await fetchPage(heiseiListUrl);
  if (heiseiHtml) {
    allSessionUrls.push(...parseSessionLinks(heiseiHtml));
  }

  // 各会期ページをスクレイピング
  for (const sessionUrl of allSessionUrls) {
    const sessionHtml = await fetchPage(sessionUrl);
    if (!sessionHtml) continue;

    // 会期ページのタイトルから会議名を取得
    const titleMatch = sessionHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const rawTitle = titleMatch
      ? titleMatch[1]!.replace(/<[^>]+>/g, "").trim()
      : "";

    const parsed = parseSessionTitle(rawTitle);
    if (!parsed) continue;

    // 年度が対象外の場合はスキップ（±1 年の幅を持たせてフィルタリングを PDF 日付に委ねる）
    if (parsed.year !== null && Math.abs(parsed.year - year) > 1) continue;

    const meetings = parseSessionPage(
      sessionHtml,
      parsed.title,
      parsed.section,
      year
    );
    results.push(...meetings);
  }

  return results;
}
