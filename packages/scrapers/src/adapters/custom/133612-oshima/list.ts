/**
 * 大島町議会 — list フェーズ
 *
 * 単一の一覧ページ (gikai-kekka.html) から全 PDF リンクを抽出する。
 * ページネーションなし。
 *
 * リンクテキストのパターン:
 *   {年号}第{回数}（{月}）大島町議会{定例会|臨時会}結果報告について [PDFファイル／{サイズ}KB]
 *
 * PDF URL パターン:
 *   /uploaded/attachment/{ID}.pdf
 */

import { BASE_ORIGIN, BASE_URL, fetchPage, parseEraYear } from "./shared";

export interface OshimaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキストから抽出したタイトル */
  title: string;
  /** 西暦年 */
  year: number;
  /** 開催月（1〜12、不明の場合は null） */
  month: number | null;
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 指定年に該当するリンクのみ返す。
 */
export function parseListPage(html: string, year: number): OshimaMeeting[] {
  const results: OshimaMeeting[] = [];

  // <a href="/uploaded/attachment/{ID}.pdf">...</a> パターンを抽出
  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ")
      .trim();

    // 年を抽出
    const entryYear = parseEraYear(rawText);
    if (!entryYear) continue;
    if (entryYear !== year) continue;

    // 開催月を抽出（例: （3月）→ 3）
    const monthMatch = rawText.match(/[（(](\d+)月[）)]/);
    const month = monthMatch ? Number(monthMatch[1]) : null;

    // PDF URL を絶対 URL に変換
    const pdfUrl = `${BASE_ORIGIN}${href}`;

    // [PDFファイル／...] などの余分なテキストを除去してタイトルを整形
    const title = rawText.replace(/\s*\[.+?\]$/, "").trim();

    // 重複チェック
    if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

    results.push({ pdfUrl, title, year: entryYear, month });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<OshimaMeeting[]> {
  const html = await fetchPage(BASE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
