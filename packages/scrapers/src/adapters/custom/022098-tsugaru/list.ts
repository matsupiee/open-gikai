/**
 * つがる市議会 — list フェーズ
 *
 * スクレイピング戦略:
 *   Step 1: 会議録トップページ (index.html) から年度別ページへのリンクを収集
 *   Step 2: 各年度別ページから PDF リンクを収集
 *
 * HTML 構造:
 *   トップページ: ul > li > a で年度別ページへのリンクを列挙
 *   年度別ページ: ul > li > a で PDF ファイルへのリンクを列挙
 *     リンクテキスト例: "令和7年第1回定例会本会議"
 *     PDF URL: /material/files/group/27/{ファイル名}.pdf
 */

import {
  BASE_ORIGIN,
  INDEX_PATH,
  detectMeetingType,
  fetchPage,
  delay,
  wareki2seireki,
} from "./shared";

export interface TsugaruSessionInfo {
  /** 会議タイトル（例: "令和7年第1回定例会本会議"） */
  title: string;
  /** 開催年（西暦） */
  year: number;
  /** 開催日 YYYY-MM-DD（リンクテキストから取得できた場合） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** PDF の絶対 URL */
  pdfUrl: string;
}

const INTER_REQUEST_DELAY_MS = 1500;

/**
 * 会議録トップページ HTML から年度別ページへのリンクを抽出する。
 * `/soshiki/shigikai/kaigiroku/` 配下のリンクを対象とし、
 * `index.html` 自体は除外する。
 */
export function parseYearPageLinks(html: string): string[] {
  const links: string[] = [];
  const pattern =
    /<a[^>]+href="([^"]*\/soshiki\/shigikai\/kaigiroku\/[^"]+\.html)"[^>]*>/gi;

  for (const m of html.matchAll(pattern)) {
    const href = m[1]!;
    // index.html 自体は除外
    if (href.endsWith("index.html")) continue;
    const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    links.push(url);
  }

  return links;
}

/**
 * リンクテキストから西暦年を抽出する。
 * 例: "令和7年第1回定例会本会議" → 2025
 *     "平成25年第1回定例会本会議" → 2013
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const m = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!m) return null;
  const yearNum = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  return wareki2seireki(m[1]!, yearNum);
}

/**
 * 年度別ページ HTML から指定年の PDF リンク一覧を抽出する。
 *
 * ページ構造:
 *   ul > li > a[href$=".pdf"] でリンクが列挙される
 *   リンクテキストに会議名が含まれる
 *   ファイルサイズが括弧付きで表記される場合がある: "(PDFファイル: 1.9MB)"
 */
export function parseYearPage(html: string, year: number): TsugaruSessionInfo[] {
  const results: TsugaruSessionInfo[] = [];

  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(linkPattern)) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/<[^>]+>/g, "").trim();

    if (!href || !rawText) continue;

    // ファイルサイズ表記 "(PDFファイル: ...)" を除去してタイトルを取得
    const title = rawText
      .replace(/\(PDFファイル[^)]*\)/g, "")
      .replace(/\(PDF[^)]*\)/g, "")
      .trim();

    if (!title) continue;

    // タイトルから年度を取得して対象年フィルタリング
    const titleYear = extractYearFromTitle(title);
    if (titleYear !== null && titleYear !== year) continue;

    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
    const meetingType = detectMeetingType(title);

    results.push({
      title,
      year: titleYear ?? year,
      heldOn: null,
      meetingType,
      pdfUrl,
    });
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 * トップページ → 年度別ページ → PDF リンクの2段階クロール。
 */
export async function fetchSessionList(
  year: number
): Promise<TsugaruSessionInfo[]> {
  const indexUrl = `${BASE_ORIGIN}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  await delay(INTER_REQUEST_DELAY_MS);

  // 年度別ページへのリンクを収集
  const yearPageUrls = parseYearPageLinks(indexHtml);

  const results: TsugaruSessionInfo[] = [];

  for (const yearPageUrl of yearPageUrls) {
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) {
      await delay(INTER_REQUEST_DELAY_MS);
      continue;
    }

    const sessions = parseYearPage(yearHtml, year);
    results.push(...sessions);

    await delay(INTER_REQUEST_DELAY_MS);
  }

  return results;
}
