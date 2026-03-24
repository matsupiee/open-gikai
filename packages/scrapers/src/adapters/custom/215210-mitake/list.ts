/**
 * 御嵩町議会 — list フェーズ
 *
 * 単一ページ（https://mitake-gikai.com/side/minutes）から
 * 全 PDF リンクを取得し、対象年でフィルタリングする。
 *
 * HTML 構造:
 *   <h3>令和6年（2024年）</h3>
 *   ◆第2回 定例会
 *   <strong>●令和6年6月12日</strong>
 *   <a href="https://mitake-gikai.com/download_file/view/445/296">→ダウンロード</a>
 */

import { BASE_ORIGIN, fetchPage, parseDateText } from "./shared";

export interface MitakeMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionType: string; // "定例会" | "臨時会" | "委員会"
  fileId: string;
}

/**
 * 会議種別テキストからセッションタイプを判定する。
 */
function detectSessionType(text: string): string {
  if (text.includes("臨時会")) return "臨時会";
  if (text.includes("委員会")) return "委員会";
  return "定例会";
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * DOM 走査ロジック:
 * - <h3> タグで年度を把握する（例: 令和6年（2024年））
 * - ◆ で始まるテキストノードで会議種別を把握する
 * - <strong> タグで開催日を取得する
 * - <a href*="download_file/view/"> でダウンロードリンクを取得する
 *
 * 対象年でフィルタリングする。
 */
export function parseListPage(
  html: string,
  targetYear: number
): MitakeMeeting[] {
  const results: MitakeMeeting[] = [];

  // HTML を行単位で処理するためにテキストを整形
  // タグを維持しながら処理できるよう正規表現で解析

  // ページ全体を走査して、コンテキスト（年度・会議種別・直前の日付）を追跡する
  // 各要素のインデックスを収集してから順序に基づいて解析する

  interface Token {
    index: number;
    type: "h3" | "strong" | "link" | "meetingType";
    text: string;
    href?: string;
    fileId?: string;
  }

  const tokens: Token[] = [];

  // <h3> タグを抽出
  for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const text = m[1]!.replace(/<[^>]+>/g, "").trim();
    tokens.push({ index: m.index!, type: "h3", text });
  }

  // ◆ で始まるテキストを含むパラグラフを抽出（strong や a タグの外にある）
  // ◆ が含まれるテキストノードを近似的に探す
  for (const m of html.matchAll(/◆([^<\n]+)/g)) {
    tokens.push({
      index: m.index!,
      type: "meetingType",
      text: `◆${m[1]!.trim()}`,
    });
  }

  // <strong> タグを抽出（日付テキスト）
  for (const m of html.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi)) {
    const text = m[1]!.replace(/<[^>]+>/g, "").trim();
    tokens.push({ index: m.index!, type: "strong", text });
  }

  // download_file/view/ を含む <a> タグを抽出
  for (const m of html.matchAll(
    /<a[^>]+href="([^"]*download_file\/view\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href = m[1]!;
    const fileId = m[2]!;
    const linkText = m[3]!.replace(/<[^>]+>/g, "").trim();
    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    tokens.push({
      index: m.index!,
      type: "link",
      text: linkText,
      href: url,
      fileId,
    });
  }

  // インデックス順にソート
  tokens.sort((a, b) => a.index - b.index);

  // 状態を追跡しながら MitakeMeeting を構築
  let currentYear: number | null = null;
  let currentSessionType = "定例会";
  let lastDateText: string | null = null;

  for (const token of tokens) {
    switch (token.type) {
      case "h3": {
        // 西暦年を抽出: 「令和6年（2024年）」→ 2024
        const yearMatch = token.text.match(/[（(](\d{4})年[）)]/);
        if (yearMatch) {
          currentYear = Number(yearMatch[1]!);
        }
        break;
      }
      case "meetingType": {
        currentSessionType = detectSessionType(token.text);
        break;
      }
      case "strong": {
        // 日付テキストを保持
        if (token.text.match(/(令和|平成)/)) {
          lastDateText = token.text;
        }
        break;
      }
      case "link": {
        if (!token.href) break;
        if (currentYear !== targetYear) break;

        // 開催日を strong テキストから取得
        const heldOn = lastDateText ? parseDateText(lastDateText) : null;
        if (!heldOn) break;

        // fileId をトークンから取得（フォールバック: URL から抽出）
        const fileIdFromUrl = token.href.match(/download_file\/view\/(\d+)/);
        const fileId = token.fileId ?? (fileIdFromUrl ? fileIdFromUrl[1]! : token.href);

        // タイトルを構築: 年度 + 会議種別
        const year = currentYear;
        const title = `令和${year - 2018}年 ${currentSessionType}（${heldOn}）`;

        results.push({
          pdfUrl: token.href,
          title,
          heldOn,
          sessionType: currentSessionType,
          fileId,
        });
        break;
      }
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number
): Promise<MitakeMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
