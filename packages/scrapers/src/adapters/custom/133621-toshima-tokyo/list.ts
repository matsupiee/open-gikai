/**
 * 利島村議会 — list フェーズ
 *
 * 単一の議会情報ページ (assembly.html) から議事録 PDF リンクを抽出する。
 * ページネーションなし。
 *
 * HTML 構造:
 *   <h3>2025年（令和7年）</h3>
 *   <p><a href="/fs/2/7/1/6/9/1/_/___1___.pdf">第1回臨時会議事録</a></p>
 *
 * フィルタリング:
 *   - href が /fs/ を含み .pdf で終わるリンクのみ
 *   - リンクテキストに「議事録」を含むもののみ（議案書・施政方針等を除外）
 */

import { BASE_ORIGIN, BASE_URL, fetchPage, parseYearHeading } from "./shared";

export interface ToshimaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（例: "第1回定例会議事録"） */
  title: string;
  /** 西暦年 */
  year: number;
  /** 会議種別（定例会 or 臨時会） */
  sessionType: "定例会" | "臨時会";
  /** 回次（例: "第1回"） */
  sessionNumber: string;
}

/**
 * HTML テキストをシンプルにデコードする（HTML エンティティを文字列に変換）。
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * リンクテキストから会議種別と回次を抽出する。
 * e.g., "第1回定例会議事録" → { sessionType: "定例会", sessionNumber: "第1回" }
 */
export function parseSessionInfo(text: string): {
  sessionType: "定例会" | "臨時会";
  sessionNumber: string;
} | null {
  const numberMatch = text.match(/第(\d+)回/);
  if (!numberMatch) return null;

  const sessionNumber = `第${numberMatch[1]}回`;

  if (text.includes("定例")) {
    return { sessionType: "定例会", sessionNumber };
  }
  if (text.includes("臨時")) {
    return { sessionType: "臨時会", sessionNumber };
  }

  return null;
}

/**
 * 議会情報ページの HTML から議事録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * <h3> 見出しから年度を特定し、そのセクション配下のリンクに年度を付与する。
 * 指定年に該当するリンクのみ返す。
 */
export function parseListPage(html: string, year: number): ToshimaMeeting[] {
  const results: ToshimaMeeting[] = [];

  // h3 見出しとリンクの両方を含むトークン列を順番に処理する
  // h3 タグが出たら currentYear を更新し、a タグが出たらそのコンテキストで処理する
  const tokenPattern =
    /<h3[^>]*>([\s\S]*?)<\/h3>|<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentYear: number | null = null;

  for (const match of html.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      // h3 タグ
      const headingText = decodeHtmlEntities(match[1]);
      currentYear = parseYearHeading(headingText);
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // a タグ
      if (currentYear !== year) continue;

      const href = match[2];
      const rawText = decodeHtmlEntities(match[3]);

      // /fs/ を含む PDF リンクのみ
      if (!href.includes("/fs/") || !href.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      // 「議事録」を含むリンクのみ（議案書・施政方針・決算書等を除外）
      if (!rawText.includes("議事録")) continue;

      const sessionInfo = parseSessionInfo(rawText);
      if (!sessionInfo) continue;

      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href}`;

      // 重複チェック
      if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

      results.push({
        pdfUrl,
        title: rawText,
        year: currentYear,
        sessionType: sessionInfo.sessionType,
        sessionNumber: sessionInfo.sessionNumber,
      });
    }
  }

  return results;
}

/**
 * 指定年の議事録 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<ToshimaMeeting[]> {
  const html = await fetchPage(BASE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
