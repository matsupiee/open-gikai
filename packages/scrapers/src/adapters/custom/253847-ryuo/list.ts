/**
 * 竜王町議会 — list フェーズ
 *
 * 2つの一覧ページからPDFリンクを収集する。
 *
 * ページ構造:
 *   - PDF リンクの href に含まれるディレクトリ名（例: r07teirei）から
 *     年・会議種別を判定する
 *   - リンクテキストには「第N日」「第N回」等の日程情報が含まれる
 *   - li 要素のテキスト（リンクなし）が会議名（例: 第3回定例会）
 */

import {
  LIST_URL_CURRENT,
  LIST_URL_KAKO,
  dirToMeetingType,
  dirToYear,
  fetchPage,
  parseFileName,
  resolveUrl,
} from "./shared";

export interface RyuoMeetingRecord {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（例: 第4日） */
  linkText: string;
  /** 会議名（例: 第3回定例会） */
  sessionTitle: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催年（西暦） */
  year: number;
  /** 回数 */
  session: number;
  /** 日数 */
  day: number;
  /** ソース URL */
  sourceListUrl: string;
}

/**
 * 一覧ページ HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * href 属性が .pdf で終わるアンカータグを対象とし、
 * ディレクトリ名パターン（[rRhH]\d{2}(teirei|rinji)）を含む href のみ収集する。
 *
 * li 要素の処理:
 *   - href なし li: 会議名候補として記録（例: 第3回定例会）
 *   - href あり li: PDF リンクとして収集
 */
export function parseListPage(html: string, sourceListUrl: string): RyuoMeetingRecord[] {
  const results: RyuoMeetingRecord[] = [];

  // li 要素をすべて抽出（リンクあり・なしの両方）
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;

  let currentSessionTitle = "";

  for (const liMatch of html.matchAll(liPattern)) {
    const liContent = liMatch[1]!;

    // <a href="..."> があるか確認
    const aMatch = liContent.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

    if (!aMatch) {
      // リンクなし li: 会議名候補
      const text = liContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (text) {
        currentSessionTitle = text;
      }
      continue;
    }

    const href = aMatch[1]!;
    const rawLinkText = aMatch[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // .pdf で終わる href のみ対象
    if (!href.toLowerCase().endsWith(".pdf")) continue;

    // ディレクトリ名パターンを確認
    const dirMatch = href.match(/([rRhH]\d{2}(?:teirei|rinji))\//i);
    if (!dirMatch) continue;

    const dir = dirMatch[1]!;
    const year = dirToYear(dir);
    if (!year) continue;

    const meetingType = dirToMeetingType(dir);
    const absoluteUrl = resolveUrl(href);

    // ファイル名から回数・日数を抽出
    const fileName = href.split("/").pop() ?? "";
    const parsed = parseFileName(fileName);
    if (!parsed) continue;

    results.push({
      pdfUrl: absoluteUrl,
      linkText: rawLinkText,
      sessionTitle: currentSessionTitle,
      meetingType,
      year,
      session: parsed.session,
      day: parsed.day,
      sourceListUrl,
    });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを両方の一覧ページから収集する。
 */
export async function fetchMeetingRecords(year: number): Promise<RyuoMeetingRecord[]> {
  const allRecords: RyuoMeetingRecord[] = [];

  for (const url of [LIST_URL_CURRENT, LIST_URL_KAKO]) {
    const html = await fetchPage(url);
    if (!html) continue;

    const records = parseListPage(html, url);
    for (const record of records) {
      if (record.year === year) {
        allRecords.push(record);
      }
    }
  }

  return allRecords;
}
