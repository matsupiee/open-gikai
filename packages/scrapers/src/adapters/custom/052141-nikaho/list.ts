/**
 * にかほ市議会 会議録 — list フェーズ
 *
 * 会議録一覧ページ (conference.html) を取得し、全タブから PDF リンクを収集する。
 *
 * ページ構造（tab ベース）:
 *   各タブ内にテーブルがあり、各行に会議名（<th>）とPDFリンク（<td>）が並ぶ。
 *
 *   <div id="tab20">
 *     <table>
 *       <thead>
 *         <tr><th>会議</th><th>1日目</th>...</tr>
 *       </thead>
 *       <tbody>
 *         <tr>
 *           <th>令和6年 第8回定例会</th>
 *           <td><a href="/pdf/36/令和6年第8回定例会1日目（11月26日）.pdf"><img ...></a></td>
 *           ...
 *         </tr>
 *       </tbody>
 *     </table>
 *   </div>
 */

import {
  BASE_ORIGIN,
  CONFERENCE_URL,
  fetchPage,
  parseDateFromFilename,
  parseTitleFromFilename,
  detectMeetingType,
} from "./shared";

export interface NikahoMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第5回定例会 1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * conference.html の HTML から PDF リンクとメタ情報を抽出する。
 *
 * 各タブ内のテーブルを走査し、<a> タグの href からファイル名を取得する。
 * ファイル名（デコード済み）から開催日・会議タイトルを解析する。
 */
export function parseConferencePage(html: string): NikahoMeeting[] {
  const results: NikahoMeeting[] = [];

  // <a> タグから PDF リンクを抽出（href が .pdf で終わるもの）
  const linkRegex = /<a\s+[^>]*href="([^"]*\.pdf)"[^>]*>/gi;

  for (const linkMatch of html.matchAll(linkRegex)) {
    const href = linkMatch[1]!;

    // 相対パスを絶対 URL に変換
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href}`;

    // URL からファイル名部分を取得（デコード）
    let decodedFilename: string;
    try {
      const urlPath = new URL(pdfUrl).pathname;
      const lastSegment = urlPath.split("/").pop() ?? "";
      decodedFilename = decodeURIComponent(lastSegment).replace(/\.pdf$/i, "");
    } catch {
      continue;
    }

    // ファイル名から開催日を解析
    const heldOn = parseDateFromFilename(decodedFilename);
    if (!heldOn) continue;

    // ファイル名から会議タイトルを解析
    const title = parseTitleFromFilename(decodedFilename);
    if (!title) continue;

    // 重複チェック（同一 URL は一度だけ）
    if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

    results.push({ pdfUrl, title, heldOn });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 会議録一覧ページを 1 回取得し、対象年の会議録のみを返す。
 */
export async function fetchMeetingList(
  year: number,
): Promise<NikahoMeeting[]> {
  const html = await fetchPage(CONFERENCE_URL);
  if (!html) return [];

  const allMeetings = parseConferencePage(html);

  // 対象年でフィルタ
  return allMeetings.filter((m) => {
    const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
    return meetingYear === year;
  });
}

// detectMeetingType を再エクスポート（detail.ts から利用）
export { detectMeetingType };
