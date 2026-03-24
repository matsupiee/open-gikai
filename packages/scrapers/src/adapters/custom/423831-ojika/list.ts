/**
 * 小値賀町議会 会議録 -- list フェーズ
 *
 * 会議録一覧ページから PDF リンクを収集する。
 *
 * ページ構造:
 *   <a href="//www.town.ojika.lg.jp/material/files/group/9/gijiroku9-1.pdf">
 *     令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)
 *   </a>
 *
 * リンクテキストから会議名・年・日を抽出する。
 * 日付は発行日（ファイルリスト表示上の date 属性またはテキストパターン）から取得する。
 *
 * ページ構造（実際）:
 *   各行は <a> タグで PDF リンクを提供する。
 *   link text 形式: "令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)"
 *   または "2024/9/10 令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)"
 */

import {
  LIST_URL,
  convertWarekiToWesternYear,
  detectMeetingType,
  fetchPage,
  resolveUrl,
  toHalfWidth,
} from "./shared";

export interface OjikaPdfLink {
  /** 会議録タイトル（例: "令和6年定例9月会議（1日目）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
  /** 開催日（YYYY-MM-DD）。解析できない場合は null */
  heldOn: string | null;
}

/**
 * リンクテキストから会議タイトルを抽出する。
 * "(PDFファイル: ...)" などを除去する。
 *
 * 例:
 *   "令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)" → "令和6年定例9月会議（1日目）"
 *   "2024/9/10 令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)" → "令和6年定例9月会議（1日目）"
 *   "2024年9月10日 令和6年定例9月会議（1日目）(PDFファイル: 695.4KB)" → "令和6年定例9月会議（1日目）"
 */
export function extractTitle(rawText: string): string {
  // PDFファイルサイズ情報を除去
  let text = rawText.replace(/\s*\(PDFファイル[^)]*\)/g, "").trim();
  // "YYYY/M/D " 形式の先頭日付を除去
  text = text.replace(/^\d{4}\/\d{1,2}\/\d{1,2}\s+/, "");
  // "YYYY年M月D日 " 形式の先頭日付を除去
  text = text.replace(/^\d{4}年\d{1,2}月\d{1,2}日\s+/, "");
  return text.trim();
}

/**
 * 一覧ページ行から日付を解析して YYYY-MM-DD を返す。
 *
 * 以下の情報ソースを順に試みる:
 * 1. リンクテキスト先頭の "YYYY/M/D" 形式
 * 2. リンクテキスト先頭の "YYYY年M月D日" 形式
 *
 * 解析できない場合は null を返す。
 */
export function parseDateFromRowText(
  rawText: string,
): string | null {
  const normalized = toHalfWidth(rawText);

  // "YYYY/M/D" 形式（リンクテキスト先頭）
  const slashDateMatch = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashDateMatch) {
    const year = Number(slashDateMatch[1]);
    const month = Number(slashDateMatch[2]);
    const day = Number(slashDateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // "YYYY年M月D日" 形式（リンクテキスト先頭）
  const kanjiDateMatch = normalized.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (kanjiDateMatch) {
    const year = Number(kanjiDateMatch[1]);
    const month = Number(kanjiDateMatch[2]);
    const day = Number(kanjiDateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}


/**
 * 一覧ページ HTML から PDF リンク一覧を抽出する。
 *
 * 実際のページ構造:
 *   <p class="file-link-item">
 *     <a class="pdf" href="//www.town.ojika.lg.jp/material/files/group/9/gijiroku9-1.pdf">
 *       2024年9月10日 令和6年定例9月会議（1日目） (PDFファイル: 695.4KB)
 *     </a>
 *   </p>
 *
 * リンクテキストに "YYYY年M月D日 タイトル" 形式で日付とタイトルが含まれる。
 */
export function parseListPage(html: string): OjikaPdfLink[] {
  const results: OjikaPdfLink[] = [];

  // material/files/group 配下の PDF リンクをすべて抽出
  const linkPattern =
    /<a[^>]*href="([^"]*material\/files\/group\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const pdfUrl = resolveUrl(href);
    const title = extractTitle(rawText);
    if (!title) continue;

    const year = convertWarekiToWesternYear(title);
    if (!year) continue;

    const heldOn = parseDateFromRowText(rawText);

    results.push({
      title,
      pdfUrl,
      meetingType: detectMeetingType(title),
      year,
      heldOn,
    });
  }

  return results;
}

/**
 * 指定年の PDF リンク一覧を取得する。
 */
export async function fetchDocumentList(year: number): Promise<OjikaPdfLink[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);

  // 指定年のみフィルタ
  return all.filter((doc) => doc.year === year);
}
