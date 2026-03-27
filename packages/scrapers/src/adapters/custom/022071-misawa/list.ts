/**
 * 三沢市議会 — list フェーズ
 *
 * 全年度の会議録が単一ページに掲載されている（ページネーションなし）。
 * 年度ごとにセクションが分かれており、各セクション内に会次（定例会・臨時会）の
 * テーブル行があり、各行に「1日目」「2日目」などの列でPDFリンクが並ぶ。
 *
 * ページ構造:
 *   年度見出し（令和X年, 平成X年）
 *     テーブル（行: 会次、列: 1日目〜4日目）
 *       <a href="/index.cfm/24,11423,c,html/11423/{filename}.pdf">
 *
 * PDF URL パターン:
 *   https://www.city.misawa.lg.jp/index.cfm/24,11423,c,html/11423/{ファイル名}.pdf
 */

import { BASE_ORIGIN, LIST_PATH, detectMeetingType, eraToWestern, fetchPage, delay } from "./shared";

export interface MisawaSessionInfo {
  /** 会議タイトル（例: "2025年第1回定例会1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 年 */
  year: number;
  /** 回次 */
  session: number;
  /** 日目（1〜4） */
  dayNumber: number;
}

const INTER_REQUEST_DELAY_MS = 1000;

/**
 * 年度見出しテキストから西暦年を抽出する。
 * e.g., "令和7年", "平成31年", "令和元年" → 西暦年
 */
export function parseYearFromHeading(text: string): number | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWestern(match[1]!, match[2]!);
}

/**
 * 行ラベル（テーブルの行見出し）から会次と会議種別を抽出する。
 * e.g., "第1回定例会" → { session: 1, type: "定例会" }
 *       "第2回臨時会" → { session: 2, type: "臨時会" }
 */
export function parseSessionLabel(text: string): {
  session: number;
  type: "定例会" | "臨時会";
} | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/第(\d+)回(定例会|臨時会)/);
  if (!match) return null;
  return {
    session: parseInt(match[1]!, 10),
    type: match[2]! as "定例会" | "臨時会",
  };
}

/**
 * 列ヘッダーから日目番号を抽出する。
 * e.g., "1日目" → 1, "2日目" → 2
 * 列インデックス（0-based）からもフォールバック可能。
 */
export function parseDayNumber(text: string, colIndex: number): number {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/(\d+)日目/);
  if (match) return parseInt(match[1]!, 10);
  return colIndex + 1;
}

/**
 * 一覧ページ HTML から指定年の会議録セッション情報を抽出する。
 *
 * ページ構造:
 * - 年度見出しがあり、その後にテーブルが続く
 * - テーブルの1列目が会次ラベル（"第1回定例会"等）
 * - テーブルのヘッダー行に "1日目", "2日目" 等のカラム名
 * - 各セルに PDF リンクが含まれる（ない場合もある）
 */
export function parseListPage(html: string, year: number): MisawaSessionInfo[] {
  const results: MisawaSessionInfo[] = [];

  // PDF URL のパターン（三沢市固有）
  const PDF_PATH_PATTERN = /\/index\.cfm\/24,11423,c,html\/11423\/([^"]+\.pdf)/i;

  // 年度セクションを特定するため、すべての見出しとPDFリンクの位置を収集
  // 年度ごとのセクション境界を特定
  interface HeadingInfo {
    index: number;
    year: number | null;
  }

  const headings: HeadingInfo[] = [];
  // 見出し要素（h2, h3, h4, h5, strong、テキストに年号を含む要素）を探す
  const headingPattern = /<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/gi;
  for (const m of html.matchAll(headingPattern)) {
    const text = m[1]!.replace(/<[^>]+>/g, "").trim();
    const y = parseYearFromHeading(text);
    if (y !== null) {
      headings.push({ index: m.index!, year: y });
    }
  }

  // 現在の年度セクションのPDFリンクのみ対象とする
  // テーブル行を解析してセッション情報を取得する

  // テーブル（<table>...</table>）を抽出
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  for (const tableMatch of html.matchAll(tablePattern)) {
    const tableHtml = tableMatch[0]!;
    const tableIndex = tableMatch.index!;

    // このテーブルが属する年度を特定
    let tableYear: number | null = null;
    for (const h of headings) {
      if (h.index < tableIndex && h.year !== null) {
        tableYear = h.year;
      }
    }

    if (tableYear !== year) continue;

    // テーブル内の列ヘッダーを取得（<th> タグ、または最初の <tr> の <td>）
    const dayColumns: number[] = []; // 各列インデックス → 日目番号
    const headerRowMatch = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    if (headerRowMatch) {
      const headerHtml = headerRowMatch[1]!;
      const thPattern = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let colIdx = 0;
      for (const thMatch of headerHtml.matchAll(thPattern)) {
        const cellText = thMatch[1]!.replace(/<[^>]+>/g, "").trim();
        const dayNum = parseDayNumber(cellText, colIdx - 1); // colIdx 0 は行ラベル列
        dayColumns.push(dayNum);
        colIdx++;
      }
    }

    // テーブルの各行を解析
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowIdx = 0;
    for (const rowMatch of tableHtml.matchAll(rowPattern)) {
      rowIdx++;
      if (rowIdx === 1) continue; // ヘッダー行はスキップ

      const rowHtml = rowMatch[1]!;
      const cellPattern = /<(t[hd])([^>]*)>([\s\S]*?)<\/\1>/gi;
      const cells: string[] = [];
      for (const cellMatch of rowHtml.matchAll(cellPattern)) {
        // 開始タグの属性とセル内容を結合（旧HTMLでは href が <td> 属性に入っている場合がある）
        cells.push(cellMatch[2]! + " " + cellMatch[3]!);
      }

      if (cells.length === 0) continue;

      // 1列目（インデックス0）が会次ラベル
      const labelText = cells[0]!.replace(/<[^>]+>/g, "").trim();
      const sessionInfo = parseSessionLabel(labelText);
      if (!sessionInfo) continue;

      // 残りの列にPDFリンクがあれば抽出
      for (let colIdx = 1; colIdx < cells.length; colIdx++) {
        const cellHtml = cells[colIdx]!;

        // PDFリンクを検索
        const linkMatch = PDF_PATH_PATTERN.exec(cellHtml);
        if (!linkMatch) continue;

        const pdfPath = linkMatch[0]!;
        const pdfUrl = pdfPath.startsWith("http") ? pdfPath : `${BASE_ORIGIN}${pdfPath}`;

        // 日目番号（列インデックスから計算、ヘッダー情報があれば優先）
        const dayNum = dayColumns[colIdx] ?? colIdx;

        const sessionTypeName = sessionInfo.type;
        const title = `${tableYear}年第${sessionInfo.session}回${sessionTypeName}${dayNum}日目`;
        const meetingType = detectMeetingType(title);

        // PDF ファイル名から開催日を抽出（YYYYMMDD-HHMMSS.pdf パターン）
        const dateMatch = pdfUrl.match(/(\d{4})(\d{2})(\d{2})-\d{6}\.pdf$/);
        const heldOn = dateMatch
          ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
          : null;

        results.push({
          title,
          heldOn,
          meetingType,
          pdfUrl,
          year: tableYear,
          session: sessionInfo.session,
          dayNumber: dayNum,
        });
      }
    }
  }

  return results;
}

/**
 * 指定年の会議録セッション一覧を取得する。
 */
export async function fetchDocumentList(year: number): Promise<MisawaSessionInfo[]> {
  const url = `${BASE_ORIGIN}${LIST_PATH}`;
  const html = await fetchPage(url);
  if (!html) return [];

  await delay(INTER_REQUEST_DELAY_MS);

  return parseListPage(html, year);
}
