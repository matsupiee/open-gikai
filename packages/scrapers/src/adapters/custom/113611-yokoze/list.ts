/**
 * 横瀬町議会 — list フェーズ
 *
 * 2 つのページから PDF リンクを収集する:
 * 1. メインページ (R2〜R7): /yokoze/about-yokoze/5696
 * 2. 旧資料室ページ (H27〜R1): /yokoze/shiryo/120
 *
 * 各ページのテーブル構造:
 * - 列ヘッダー: 「令和○年」「平成○年」形式
 * - セル: 「○月定例会」「○月臨時会」テキストと PDF リンク
 */

import {
  ARCHIVE_LIST_URL,
  MAIN_LIST_URL,
  detectMeetingType,
  extractYearFromTitle,
  fetchPage,
  parseSessionFromCell,
  parseYearFromHeader,
  toAbsoluteUrl,
} from "./shared";

export interface YokozeMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル e.g. "令和6年第2回定例会" */
  title: string;
  /** 開催年 */
  year: number;
  /** 開催月 */
  month: number;
  /** 会議種別テキスト e.g. "定例会", "臨時会" */
  sessionType: string;
  /** 開催日 YYYY-MM-DD（月初として設定、実際の日付は PDF から取得） */
  heldOn: string | null;
}

/**
 * ページ HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * テーブル構造を解析して、各列の年度と各セルの月・種別を対応付ける。
 */
export function parseListPage(html: string): YokozeMeeting[] {
  const results: YokozeMeeting[] = [];
  const seen = new Set<string>();

  // テーブルを抽出
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  const tables = html.match(tablePattern) ?? [];

  for (const tableHtml of tables) {
    // 行を抽出
    const rowPattern = /<tr[\s\S]*?<\/tr>/gi;
    const rows = tableHtml.match(rowPattern) ?? [];

    if (rows.length < 2) continue;

    // ヘッダー行から年度を抽出
    const headerRow = rows[0]!;
    const headerCells = extractCells(headerRow);

    const yearColumns: (number | null)[] = headerCells.map((cell) => {
      const text = stripTags(cell).trim();
      return parseYearFromHeader(text);
    });

    // 年度列が1つも取れない場合はこのテーブルをスキップ
    if (!yearColumns.some((y) => y !== null)) continue;

    // データ行を処理
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]!;
      const cells = extractCells(row);

      for (let colIdx = 0; colIdx < cells.length; colIdx++) {
        const year = yearColumns[colIdx];
        if (!year) continue;

        const cellHtml = cells[colIdx]!;
        const cellText = stripTags(cellHtml).trim();
        if (!cellText) continue;

        const sessionInfo = parseSessionFromCell(cellText);
        if (!sessionInfo) continue;

        // PDF リンクを抽出
        const pdfMatch = cellHtml.match(/href="([^"]+\.pdf[^"]*)"/i);
        if (!pdfMatch) continue;

        const pdfUrl = toAbsoluteUrl(pdfMatch[1]!);

        if (seen.has(pdfUrl)) continue;
        seen.add(pdfUrl);

        // 和暦タイトルを構築
        const eraTitle = buildEraTitle(year);
        const title = `${eraTitle}（${sessionInfo.month}月）${sessionInfo.sessionType}`;

        const heldOn = `${year}-${String(sessionInfo.month).padStart(2, "0")}-01`;

        results.push({
          pdfUrl,
          title,
          year,
          month: sessionInfo.month,
          sessionType: sessionInfo.sessionType,
          heldOn,
        });
      }
    }
  }

  return results;
}

/**
 * HTML から <td> または <th> の内容を抽出する。
 */
function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  for (const match of rowHtml.matchAll(cellPattern)) {
    cells.push(match[1]!);
  }
  return cells;
}

/**
 * HTML タグを除去してテキストだけ返す。
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 西暦から和暦タイトル文字列を返す。
 * e.g., 2024 -> "令和6年", 2019 -> "令和元年", 2015 -> "平成27年"
 */
export function buildEraTitle(year: number): string {
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return reiwaYear === 1 ? "令和元年" : `令和${reiwaYear}年`;
  }
  const heiseiYear = year - 1988;
  return heiseiYear === 1 ? "平成元年" : `平成${heiseiYear}年`;
}

/**
 * 指定年の会議録リストを取得する。
 * メインページと旧資料室ページの両方を取得し、指定年のものをフィルタリングする。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number,
): Promise<YokozeMeeting[]> {
  const meetings: YokozeMeeting[] = [];
  const seen = new Set<string>();

  // メインページと旧資料室ページの両方を処理
  const urls = [MAIN_LIST_URL, ARCHIVE_LIST_URL];

  for (const url of urls) {
    const html = await fetchPage(url);
    if (!html) continue;

    const parsed = parseListPage(html);
    for (const m of parsed) {
      if (m.year !== year) continue;
      if (seen.has(m.pdfUrl)) continue;
      seen.add(m.pdfUrl);
      meetings.push(m);
    }
  }

  return meetings;
}

export { detectMeetingType, extractYearFromTitle };
