/**
 * 小豆島町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. インデックスページから年別一覧ページの URL を収集
 * 2. 各年別一覧ページから PDF リンクと会議種別（<h2>）を収集
 */

import { INDEX_URL, fetchPage, resolveUrl } from "./shared";

export interface ShodoshimaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingName: string;
}

/**
 * インデックスページから年別一覧ページの URL を抽出する。
 *
 * 対象: /gyousei/choseijoho/gikai/kaigiroku/{数値ID}.html にマッチするリンク
 */
export function parseIndexPage(html: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const yearPagePattern =
    /href="((?:https?:)?(?:\/\/www\.town\.shodoshima\.lg\.jp)?\/gyousei\/choseijoho\/gikai\/kaigiroku\/(\d+)\.html)"/g;

  for (const match of html.matchAll(yearPagePattern)) {
    const href = match[1]!;
    const url = resolveUrl(href);
    if (!seen.has(url)) {
      seen.add(url);
      results.push(url);
    }
  }

  return results;
}

/**
 * 年別一覧ページから PDF リンクと会議種別（<h2>）を抽出する。
 *
 * HTML 構造: <h2>3月定例会</h2> の後に <p><a href="...pdf">日付</a></p> が並ぶ。
 * <h2> と <p><a> の DOM 順序で各 PDF がどの会議種別に属するかを対応付ける。
 */
export function parseYearPage(
  html: string
): { pdfUrl: string; sessionType: string; label: string }[] {
  const results: { pdfUrl: string; sessionType: string; label: string }[] = [];

  // h2 と pdf リンクを順番に処理するためにトークン列を作る
  // h2 開始位置と pdf リンク位置を両方収集し、位置順に並べる
  type Token =
    | { kind: "h2"; text: string; index: number }
    | { kind: "pdf"; href: string; label: string; index: number };

  const tokens: Token[] = [];

  // h2 見出しを抽出
  const h2Pattern = /<h2[^>]*>([^<]+)<\/h2>/gi;
  for (const match of html.matchAll(h2Pattern)) {
    tokens.push({
      kind: "h2",
      text: match[1]!.trim(),
      index: match.index!,
    });
  }

  // PDF リンクを抽出（プロトコル相対 URL も対応）
  const pdfPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;
  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    const label = match[2]!.trim();
    tokens.push({
      kind: "pdf",
      href,
      label,
      index: match.index!,
    });
  }

  // 位置順にソート
  tokens.sort((a, b) => a.index - b.index);

  let currentSessionType = "";
  for (const token of tokens) {
    if (token.kind === "h2") {
      currentSessionType = token.text;
    } else if (token.kind === "pdf" && currentSessionType) {
      results.push({
        pdfUrl: resolveUrl(token.href),
        sessionType: currentSessionType,
        label: token.label,
      });
    }
  }

  return results;
}

/**
 * 会議種別テキストと日付ラベルから開催日 (YYYY-MM-DD) を推定する。
 *
 * ラベル例: "3月14日 (PDFファイル: 423.3KB)"
 * sessionType 例: "3月定例会", "6月定例会", "1月臨時会"
 *
 * 年は yearPageUrl から推定する（年別ページの URL に年の情報は含まれないが
 * 呼び出し元の year パラメータを使用する）。
 */
export function parseHeldOn(
  label: string,
  sessionType: string,
  year: number
): string | null {
  // ラベルから月日を抽出: "3月14日 ..." → month=3, day=14
  const dateMatch = label.match(/(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]!, 10);
    const day = parseInt(dateMatch[2]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // ラベルに日付がない場合は sessionType から月のみ推定
  const sessionMonthMatch = sessionType.match(/(\d{1,2})月/);
  if (sessionMonthMatch) {
    const month = parseInt(sessionMonthMatch[1]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<ShodoshimaMeeting[]> {
  // Step 1: インデックスページから年別 URL を収集
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) return [];

  const yearPageUrls = parseIndexPage(indexHtml);
  if (yearPageUrls.length === 0) return [];

  const results: ShodoshimaMeeting[] = [];

  // Step 2: 各年別ページを巡回
  // 小豆島町のページには年情報が URL に含まれないため、
  // 全年別ページを取得して year パラメータでフィルタリングする。
  // ただし全ページを取得するのは非効率なため、まずインデックスページの
  // リンクテキストから年を推定する。
  // インデックスページのリンクテキストから年マッピングを構築する
  const yearUrlMap = parseIndexPageWithYear(indexHtml, year);

  for (const yearPageUrl of yearUrlMap) {
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    const entries = parseYearPage(yearHtml);

    for (const entry of entries) {
      const heldOn = parseHeldOn(entry.label, entry.sessionType, year);
      if (!heldOn) continue;

      results.push({
        pdfUrl: entry.pdfUrl,
        title: `${entry.sessionType} ${entry.label.replace(/\s*\(PDFファイル[^)]*\)/, "").trim()}`,
        heldOn,
        meetingName: entry.sessionType,
      });
    }
  }

  return results;
}

/**
 * インデックスページから指定年に対応する年別ページ URL のみを抽出する。
 *
 * インデックスページのリンクテキストには年の情報が含まれる場合がある。
 * 例: "令和6年（2024年）" → year=2024
 * 年情報がリンク周辺にない場合は全ページを返す。
 */
export function parseIndexPageWithYear(html: string, year: number): string[] {
  // インデックスページのリンクと周辺テキストから年を判定する
  // 構造例:
  // <li><a href="/gyousei/.../8342.html">令和6年（2024年）</a></li>
  // またはリンクテキストが年を含む場合
  const results: string[] = [];
  const seen = new Set<string>();

  // 年別ページリンクのパターン: リンクテキストに西暦年を含むケース
  const linkWithYearPattern =
    /<a[^>]+href="([^"]+\/gyousei\/choseijoho\/gikai\/kaigiroku\/\d+\.html)"[^>]*>([^<]*)<\/a>/gi;

  let foundYearMatch = false;

  for (const match of html.matchAll(linkWithYearPattern)) {
    const href = match[1]!;
    const linkText = match[2]!;

    // リンクテキストから西暦年を抽出
    const yearInText = linkText.match(/\(?(\d{4})年?\)?/);
    if (yearInText) {
      const linkYear = parseInt(yearInText[1]!, 10);
      if (linkYear === year) {
        const url = resolveUrl(href);
        if (!seen.has(url)) {
          seen.add(url);
          results.push(url);
          foundYearMatch = true;
        }
      }
    }
  }

  // リンクテキストに年情報がなかった場合は全ページを返す
  if (!foundYearMatch) {
    return parseIndexPage(html);
  }

  return results;
}
