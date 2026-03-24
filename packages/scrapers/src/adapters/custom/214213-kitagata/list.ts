/**
 * 北方町議会 — list フェーズ
 *
 * 年度別ページから会議録 PDF リンクを収集する。
 *
 * - `a[href]` で .pdf へのリンクを抽出
 * - `/material/files/group/12/` を含む href のみを対象
 * - ファイル名に `gijiroku` を含むものを会議録本文として識別
 * - リンクテキストから開催日・会議名を抽出
 */

import { BASE_ORIGIN, buildYearPageUrl, fetchPage, parseDateText } from "./shared";

export interface KitagataMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionTitle: string;
}

/**
 * 年度別ページの HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <h2>第4回（9月）定例会</h2>
 *   <ul>
 *     <li><a href="//www.town.kitagata.gifu.jp/material/files/group/12/r60901gijiroku.pdf">
 *       北方町定例会第1号 令和6年9月2日（PDFファイル：60.7KB）
 *     </a></li>
 *   </ul>
 */
export function parseYearPage(html: string): KitagataMeeting[] {
  const results: KitagataMeeting[] = [];

  // 現在の見出し（h2/h3）をトラッキングしながら処理
  // h2/h3 タグと a タグを順番に抽出する
  const tokenRegex =
    /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentHeading = "";

  for (const match of html.matchAll(tokenRegex)) {
    const fullMatch = match[0]!;

    if (/^<h[23]/i.test(fullMatch)) {
      // 見出しタグ
      currentHeading = match[1]!.replace(/<[^>]+>/g, "").trim();
      continue;
    }

    // a タグ
    const href = match[2]!;
    const rawText = match[3]!.replace(/<[^>]+>/g, "").trim();

    // /material/files/group/12/ を含む href のみ対象
    if (!href.includes("/material/files/group/12/")) continue;

    // .pdf ファイルのみ
    if (!/\.pdf$/i.test(href)) continue;

    // gijiroku を含むファイル名のみ会議録本文として扱う
    const filename = href.split("/").pop() ?? "";
    if (!filename.toLowerCase().includes("gijiroku")) continue;

    // URL を絶対 URL に変換
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // 開催日を抽出
    const heldOn = parseDateText(rawText);
    if (!heldOn) continue;

    // 会議名を抽出
    // リンクテキスト例: "北方町定例会第1号 令和6年9月2日（PDFファイル：60.7KB）"
    const titleMatch = rawText.match(/北方町(?:定例会|臨時会)第?\d*号?/);
    const title = titleMatch ? titleMatch[0] : rawText.split(/\s/)[0] ?? rawText;

    // セッションタイトル（見出し）
    const sessionTitle = currentHeading || title;

    results.push({ pdfUrl, title, heldOn, sessionTitle });
  }

  return results;
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<KitagataMeeting[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html);
}
