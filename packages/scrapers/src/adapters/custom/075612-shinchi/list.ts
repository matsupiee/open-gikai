/**
 * 新地町議会 会議録 — list フェーズ
 *
 * 取得フロー:
 * 1. 指定年に対応する年度コードを計算
 * 2. 年度別一覧ページ（{年度コード}.html）を取得
 * 3. HTML から PDF リンク（pdf/ で始まるリンク）を収集
 * 4. PDF のメタ情報（タイトル、年度コード、ファイル名）を返す
 *
 * ページ構造（年度別一覧ページ）:
 *   - <a href="pdf/{年度コード}/{ファイル名}.pdf">{会議名}</a>
 */

import {
  BASE_URL,
  buildYearPageUrl,
  fetchPage,
  westernYearToYearCode,
} from "./shared";

export interface ShinchiMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル */
  title: string;
  /** 年度コード (e.g., "R0600") */
  yearCode: string;
  /** PDF ファイル名 (e.g., "R06.12T.pdf") */
  fileName: string;
}

/**
 * 年度別一覧ページの HTML から PDF エントリを抽出する。
 */
export function parsePdfLinks(html: string, yearCode: string): ShinchiMeeting[] {
  const results: ShinchiMeeting[] = [];
  const seen = new Set<string>();

  // pdf/ で始まるリンクを抽出
  const linkRegex = /<a[^>]+href="(pdf\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawTitle = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawTitle) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const pdfUrl = `${BASE_URL}/${href}`;
    const fileName = href.split("/").pop() ?? href;

    results.push({
      pdfUrl,
      title: rawTitle,
      yearCode,
      fileName,
    });
  }

  return results;
}

/**
 * 指定年の全会議録一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<ShinchiMeeting[]> {
  const yearCode = westernYearToYearCode(year);
  if (!yearCode) return [];

  const url = buildYearPageUrl(yearCode);
  const html = await fetchPage(url);
  if (!html) return [];

  return parsePdfLinks(html, yearCode);
}
