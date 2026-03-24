/**
 * 大蔵村議会 — list フェーズ
 *
 * 1ページに全年度の会議録 PDF リンクが掲載されるシンプルな構造。
 * 対象ページをパースし、material/files/group/9/ 配下の PDF リンクを抽出する。
 *
 * ページ構造（プロトコル相対 URL）:
 *   <a href="//www.vill.ohkura.yamagata.jp/material/files/group/9/R6teirei12gatsu.pdf">定例会12月（R6teirei12gatsu.pdf）</a>
 */

import { BASE_ORIGIN, buildTitleFromFilename, fetchPage, parseDateFromFilename } from "./shared";

export interface OkuraMeeting {
  pdfUrl: string;
  title: string;
  /** YYYY-MM-DD（1日固定） */
  heldOn: string;
  meetingKind: "teirei" | "rinji";
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * - material/files/group/9/ 配下の .pdf リンクのみ対象
 * - ファイル名から会議タイトルと開催日（月の1日）を生成
 */
export function parseListPage(
  html: string,
  targetYear: number
): OkuraMeeting[] {
  const results: OkuraMeeting[] = [];

  // material/files/group/9/ 配下の PDF リンクを収集
  const linkRegex = /<a[^>]+href="([^"]*material\/files\/group\/9\/[^"]+\.pdf)"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;

    // 完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      // プロトコル相対 URL: //www.vill.ohkura.yamagata.jp/material/...
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // ファイル名（拡張子なし）を取得
    const filenameMatch = pdfUrl.match(/\/([^/]+)\.pdf$/i);
    if (!filenameMatch) continue;
    const filenameNoExt = filenameMatch[1]!;

    // ファイル名から年と月を取得
    const dateInfo = parseDateFromFilename(filenameNoExt);
    if (!dateInfo) continue;

    // 対象年でフィルタリング
    if (dateInfo.year !== targetYear) continue;

    // タイトルを構築
    const title = buildTitleFromFilename(filenameNoExt);
    if (!title) continue;

    // meetingKind を判定
    const meetingKind = filenameNoExt.toLowerCase().includes("rinji")
      ? "rinji"
      : "teirei";

    // 開催日は月の1日とする（PDF内には具体的な日付なし）
    const heldOn = `${dateInfo.year}-${String(dateInfo.month).padStart(2, "0")}-01`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingKind: meetingKind as "teirei" | "rinji",
    });
  }

  // 年月でソート（新しい順）
  results.sort((a, b) => b.heldOn.localeCompare(a.heldOn));

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<OkuraMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
