/**
 * 苓北町議会 — list フェーズ
 *
 * 単一の会議録一覧ページから PDF URL を収集する:
 * https://reihoku-kumamoto.jp/kiji003676/index.html
 *
 * - ページネーションなし（全会議録が一覧で表示される）
 * - PDF リンクは相対パスで提供される
 * - リンクテキストから年度・回次・会議種別を抽出する
 */

import { BASE_URL, detectMeetingType, fetchPage, parseWarekiYear } from "./shared";

export interface ReihokuPdfRecord {
  /** 会議タイトル（例: "令和6年第2回定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催年（西暦） */
  year: number;
}

const LIST_URL = `${BASE_URL}index.html`;

/**
 * 一覧ページの HTML から PDF リンクを抽出する。
 *
 * 対応パターン:
 *   <a href="3_676_3438_up_h6vpiiko.pdf" target="_blank">
 *     <img ... />
 *     令和8年第1回臨時会（PDF：432.2キロバイト）
 *     <img ... />
 *   </a>
 */
export function parsePdfLinks(html: string): ReihokuPdfRecord[] {
  const records: ReihokuPdfRecord[] = [];
  const seen = new Set<string>();

  // .pdf へのリンクを抽出
  const linkPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const innerHtml = m[2]!;

    // テキストノードを取得（img タグを除去）
    const linkText = innerHtml
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!linkText) continue;

    // ファイルサイズ情報を除去: "（PDF：432.2キロバイト）"
    const title = linkText
      .replace(/[（(]PDF[：:][^）)]+[）)]/gi, "")
      .trim();

    if (!title) continue;

    // 会議録タイトルの基本パターンチェック
    const sessionMatch = title.match(/(令和|平成)(元|\d+)年第(\d+)回(定例会|臨時会)/);
    if (!sessionMatch) continue;

    const year = parseWarekiYear(title);
    if (year === null) continue;

    // PDF の絶対 URL を組み立てる
    const pdfUrl = href.startsWith("http")
      ? href
      : new URL(href, BASE_URL).toString();

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    records.push({
      title,
      pdfUrl,
      meetingType: detectMeetingType(title),
      year,
    });
  }

  return records;
}

/**
 * 指定年度の PDF レコード一覧を取得する。
 * 苓北町は全会議録が単一ページにあるため、一度取得してフィルタリングする。
 */
export async function fetchPdfList(year: number): Promise<ReihokuPdfRecord[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parsePdfLinks(html);
  return allRecords.filter((r) => r.year === year);
}
