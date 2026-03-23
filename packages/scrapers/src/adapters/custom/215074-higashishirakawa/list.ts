/**
 * 東白川村議会 — list フェーズ
 *
 * 単一ページ（https://www.vill.higashishirakawa.gifu.jp/sonsei/gikai/kaigiroku/）から
 * 全 PDF リンクを取得し、対象年でフィルタリングする。
 *
 * HTML 構造:
 *   <h3>2025年(令和7年)</h3>
 *     <h4>令和7年 第1回 定例会</h4>
 *       <p><a href="/files/upload/{UUID}.pdf">令和7年 第1回 東白川村議会定例会会議録(第1号 令和7年3月4日)(PDF版:849KB)</a></p>
 *     <h4>令和7年 第1回 臨時会</h4>
 *       <p><a href="/files/upload/{UUID}.pdf">令和7年 第1回 東白川村議会臨時会会議録(令和7年1月15日)(PDF版:448KB)</a></p>
 */

import { BASE_ORIGIN, fetchPage, parseDateText } from "./shared";

export interface HigashishirakawaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionType: string; // "定例会" | "臨時会"
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 目次 PDF は除外する。
 * 対象年でフィルタリングする。
 */
export function parseListPage(
  html: string,
  targetYear: number
): HigashishirakawaMeeting[] {
  const results: HigashishirakawaMeeting[] = [];

  // h4 見出しからセッション情報を収集
  const h4Pattern = /<h4[^>]*>([\s\S]*?)<\/h4>/g;
  const sessions: { index: number; text: string; sessionType: string }[] = [];

  for (const match of html.matchAll(h4Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    const sessionType = text.includes("臨時会") ? "臨時会" : "定例会";
    sessions.push({ index: match.index!, text, sessionType });
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\/files\/upload\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次 PDF を除外
    if (linkText.includes("目次")) continue;

    // リンクテキストから開催日を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // 対象年でフィルタリング
    const heldYear = Number(heldOn.slice(0, 4));
    if (heldYear !== targetYear) continue;

    // 現在のセッションタイプを特定
    let sessionType = "定例会";
    for (const session of sessions) {
      if (session.index < match.index!) {
        sessionType = session.sessionType;
      }
    }

    // PDF URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // タイトルを構築（PDF版:xxxKB の部分を除去）
    const title = linkText
      .replace(/\(PDF版[^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    results.push({ pdfUrl, title, heldOn, sessionType });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number
): Promise<HigashishirakawaMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
