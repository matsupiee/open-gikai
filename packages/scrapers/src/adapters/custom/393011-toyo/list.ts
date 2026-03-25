/**
 * 東洋町議会 — list フェーズ
 *
 * トップページから年度別ページ URL を収集し、各年度ページから PDF リンクを収集する。
 *
 * ページ構造（トップページ）:
 * - div#pb_main > ul > li > a: 年度リンク（例: <a href="gikai263.html">令和7年</a>）
 *
 * ページ構造（年度別ページ）:
 * - div#pb_main > div > h3: 会議見出し（例: 令和７年第１回定例会　会議録）
 * - div#pb_main > div > p.pb_file > a: PDF リンク（例: R7.3.5令和7年第1回定例会(1日目)　会議録）
 */

import { BASE_ORIGIN, LIST_URL, fetchPage } from "./shared";

export interface ToyoYearLink {
  /** 年度テキスト（例: 令和7年） */
  text: string;
  /** 年度ページ URL（例: http://www.town.toyo.kochi.jp/gikai-toyo/gikai263.html） */
  url: string;
}

export interface ToyoPdfLink {
  /** 会議の見出し（例: 令和7年第1回定例会　会議録） */
  session: string;
  /** PDF リンクテキスト（例: R7.3.5令和7年第1回定例会(1日目)　会議録） */
  text: string;
  /** PDF URL */
  pdfUrl: string;
}

/**
 * トップページ HTML から年度別ページリンクを抽出する（テスト可能な純粋関数）。
 *
 * 抽出条件:
 * - div#pb_main 内の ul > li > a タグ
 * - テキストが「令和X年」または「平成X年」のパターン
 */
export function parseTopPage(html: string): ToyoYearLink[] {
  const results: ToyoYearLink[] = [];

  // div#pb_main 内を抽出
  const mainMatch = html.match(/<div[^>]*id="pb_main"[^>]*>([\s\S]*?)<\/div>/i);
  if (!mainMatch) return results;

  const mainContent = mainMatch[1]!;

  // ul > li > a タグのリンクを抽出
  const linkPattern = /<a\s+href="(gikai\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of mainContent.matchAll(linkPattern)) {
    const href = match[1]!;
    const text = match[2]!.trim();

    // 「令和X年」または「平成X年」のパターンのみ対象
    if (!/^(令和|平成)\d+年$/.test(text)) continue;

    const url = `${BASE_ORIGIN}/gikai-toyo/${href}`;
    results.push({ text, url });
  }

  return results;
}

/**
 * 新形式のリンクテキストから日付を抽出する。
 * e.g., "R7.3.5令和7年第1回定例会(1日目)　会議録" → "2025-03-05"
 */
export function parseDateFromNewFormat(text: string): string | null {
  const match = text.match(/^R(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  const reiwaNen = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  const westernYear = reiwaNen + 2018;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 旧形式のリンクテキストから日付を抽出する。
 * e.g., "平成25年12月5日会議録" → "2013-12-05"
 */
export function parseDateFromOldFormat(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストから日付を抽出する。
 * 新形式（R7.3.5...）を優先し、失敗した場合は旧形式（平成X年X月X日...）を試みる。
 */
export function parseDateFromLinkText(text: string): string | null {
  return parseDateFromNewFormat(text) ?? parseDateFromOldFormat(text);
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - div#pb_main 内の div > h3: 会議見出し
 * - div#pb_main 内の div > p.pb_file > a: PDF リンク
 */
export function parseYearPage(
  html: string,
  pageUrl: string
): ToyoPdfLink[] {
  const results: ToyoPdfLink[] = [];

  // div#pb_main 内を抽出（最外の div#pb_main だけ取得）
  const mainMatch = html.match(/<div[^>]*id="pb_main"[^>]*>([\s\S]*)/i);
  if (!mainMatch) return results;

  const mainContent = mainMatch[1]!;
  const baseDir = pageUrl.substring(0, pageUrl.lastIndexOf("/") + 1);

  // div > h3 と div > p.pb_file を順番に処理
  let currentSession = "";

  // h3 タグの位置と内容を収集
  const h3Positions: { index: number; text: string }[] = [];
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (const match of mainContent.matchAll(h3Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    h3Positions.push({ index: match.index!, text });
  }

  // p.pb_file 内の a タグを抽出
  const pFilePattern =
    /<p[^>]*class="pb_file"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of mainContent.matchAll(pFilePattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // この PDF リンクに対応するセクション（直前の h3）を特定
    currentSession = "";
    for (const h3 of h3Positions) {
      if (h3.index < linkIndex) {
        currentSession = h3.text;
      }
    }

    // PDF URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = baseDir + href;
    }

    results.push({
      session: currentSession,
      text: rawText,
      pdfUrl,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 *
 * トップページから年度ページ URL を収集し、
 * 指定年に対応する年度ページから PDF リンクを収集する。
 */
export async function fetchMeetingList(
  year: number
): Promise<ToyoPdfLink[]> {
  const topHtml = await fetchPage(LIST_URL);
  if (!topHtml) return [];

  const yearLinks = parseTopPage(topHtml);

  const results: ToyoPdfLink[] = [];

  for (const yearLink of yearLinks) {
    const yearHtml = await fetchPage(yearLink.url);
    if (!yearHtml) continue;

    const pdfLinks = parseYearPage(yearHtml, yearLink.url);

    for (const link of pdfLinks) {
      // 日付を抽出して年度をフィルタリング
      const heldOn = parseDateFromLinkText(link.text);
      if (!heldOn) continue;

      const linkYear = parseInt(heldOn.substring(0, 4), 10);
      if (linkYear !== year) continue;

      results.push(link);
    }
  }

  return results;
}
