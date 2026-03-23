/**
 * 道志村議会 -- list フェーズ
 *
 * 会議録一覧ページ (info.php?if_id=719&ka_id=7) は単一ページで
 * ページネーションなし。全 PDF リンクが 1 つの HTML テーブルに掲載されている。
 *
 * テーブル構成:
 *   | 会議録（PDF リンク） | 会期（開催日） |
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  parseWarekiYear,
  parseDateText,
  fetchPage,
} from "./shared";

export interface DoshiSessionInfo {
  /** 会議タイトル（例: "令和7年第6回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

const LIST_URL = `${BASE_ORIGIN}/ka/info.php?if_id=719&ka_id=7`;

/**
 * 指定年度の全セッションを収集する。
 * 一覧ページからすべての PDF リンクを取得し、対象年度に絞り込む。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number,
): Promise<DoshiSessionInfo[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parseListPage(html);

  return allRecords.filter((r) => {
    const seirekiYear = parseWarekiYear(r.title);
    return seirekiYear !== null && seirekiYear === year;
  });
}

/**
 * 一覧ページ HTML から全 PDF リンクとメタ情報を抽出する。
 *
 * 各行の構造:
 * <tr>
 *   <td><a href="/upload/file/...">令和7年第6回定例会会議録（PDF）</a></td>
 *   <td>令和7年12月9日～12日</td>
 * </tr>
 */
export function parseListPage(html: string): DoshiSessionInfo[] {
  const records: DoshiSessionInfo[] = [];

  // テーブル行を抽出
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1]!;

    // td セルを抽出
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]!);
    }

    if (cells.length < 2) continue;

    // 1列目からリンクを抽出
    const linkMatch = cells[0]!.match(/<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([^<]+)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1]!;
    const linkText = linkMatch[2]!.trim();

    // 2列目から開催日を抽出
    const dateText = cells[1]!.replace(/<[^>]*>/g, "").trim();

    // タイトルから会議名を抽出（「会議録（PDF）」「会議録(PDF)」を除去）
    const titleMatch = linkText.match(
      /^((?:令和|平成)(?:元|\d+)年第\d+回(?:定例会|臨時会))/,
    );
    const title = titleMatch ? titleMatch[1]! : linkText.replace(/会議録[（(]?PDF[）)]?/g, "").trim();

    // 開催日をパース
    const heldOn = parseDateText(dateText);
    if (!heldOn) continue;

    // PDF URL を構築
    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    const meetingType = detectMeetingType(title);

    records.push({ title, heldOn, pdfUrl, meetingType });
  }

  return records;
}
