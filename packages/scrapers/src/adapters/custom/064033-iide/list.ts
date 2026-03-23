/**
 * 飯豊町議会 — list フェーズ
 *
 * 1ページに全年度の会議録 PDF リンクが掲載される。
 * 【令和○年第○回定例会】等の見出しから会議名を、
 * リンクテキスト中の（令和○年○月○日）から開催日を取得する。
 */

import { BASE_ORIGIN, fetchPage } from "./shared";

export interface IideMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

/**
 * 和暦の開催日テキストから YYYY-MM-DD を返す。
 * 全角・半角数字の両方に対応する。
 * e.g., "令和７年６月５日" → "2025-06-05"
 * e.g., "令和6年12月5日" → "2024-12-05"
 */
export function parseDateText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 * - 【令和○年第○回定例会】 等の見出しでセクション分け
 * - ・一般質問（令和○年○月○日） のリンクテキストに PDF URL と日付
 *
 * year が指定された場合、そのカレンダー年に該当する会議録のみ返す。
 */
export function parseListPage(
  html: string,
  baseUrl: string,
  year?: number,
): IideMeeting[] {
  const results: IideMeeting[] = [];

  // 見出し【...】の位置を収集
  const sessionHeaders: { index: number; name: string }[] = [];
  const headerPattern = /【([^】]+)】/g;
  for (const match of html.matchAll(headerPattern)) {
    sessionHeaders.push({
      index: match.index!,
      name: match[1]!.trim(),
    });
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // baseUrl からベースディレクトリを構築
  const baseDir = baseUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 現在のセッションを特定
    let currentSession = "";
    for (const header of sessionHeaders) {
      if (header.index < linkIndex) {
        currentSession = header.name;
      }
    }

    // リンクテキストから日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // year フィルタ: カレンダー年で絞り込む
    if (year !== undefined) {
      const heldYear = parseInt(heldOn.split("-")[0]!, 10);
      if (heldYear !== year) continue;
    }

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

    // タイトルを構築: セッション名 + リンクテキスト（ファイルサイズ等を除去）
    const cleanLinkText = linkText
      .replace(/\([\d,.]+KB\)/gi, "")
      .replace(/\([\d,.]+MB\)/gi, "")
      .trim();
    const title = currentSession
      ? `${currentSession} ${cleanLinkText}`
      : cleanLinkText;

    results.push({ pdfUrl, title, heldOn, sessionName: currentSession });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<IideMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, baseUrl, year);
}
