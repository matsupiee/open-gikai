/**
 * 身延町議会 -- list フェーズ
 *
 * 会議録一覧ページ (/page/1455.html) は単一ページで
 * ページネーションなし。全 PDF リンクが 1 ページに掲載されている。
 *
 * 各 PDF リンクのテキストに「令和X年第Y回定例会」形式のラベルが付いている。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
} from "./shared";

export interface MinobuSessionInfo {
  /** 会議タイトル（例: "令和6年第4回定例会"） */
  title: string;
  /** 西暦年 */
  year: number;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const LIST_URL = `${BASE_ORIGIN}/page/1455.html`;

/**
 * 指定年度の全セッションを収集する。
 * 一覧ページからすべての PDF リンクを取得し、対象年度に絞り込む。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number,
): Promise<MinobuSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parseListPage(html);

  return allRecords.filter((r) => r.year === year);
}

/**
 * 一覧ページ HTML から全 PDF リンクとメタ情報を抽出する（純粋関数）。
 *
 * 対象リンク例:
 * <a href="/uploaded/attachment/3028.pdf">令和6年第4回定例会</a>
 */
export function parseListPage(html: string): MinobuSessionInfo[] {
  const records: MinobuSessionInfo[] = [];

  // /uploaded/attachment/*.pdf へのリンクを抽出
  const linkPattern = /<a\s[^>]*href="(\/uploaded\/attachment\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1]!;
    const label = match[2]!.trim();

    // ラベルから和暦年を抽出
    const year = parseWarekiYear(label);
    if (!year) continue;

    // 会議タイトルを正規化（「会議録」等のサフィックスを除去）
    const titleMatch = label.match(
      /^((?:令和|平成)(?:元|\d+)年第\d+回(?:定例会|臨時会))/,
    );
    const title = titleMatch ? titleMatch[1]! : label;

    const pdfUrl = `${BASE_ORIGIN}${href}`;
    const meetingType = detectMeetingType(title);

    records.push({ title, year, pdfUrl, meetingType });
  }

  return records;
}
