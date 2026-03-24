/**
 * 大宜味村議会 会議録 — list フェーズ
 *
 * 会議録一覧ページ（単一ページ）から全 PDF リンクとメタ情報を収集する。
 *
 * サイト構造:
 *   - 全年度・全会議が単一ページに列挙（ページネーションなし）
 *   - PDF リンクの href 属性末尾が ".pdf"
 *   - ファイル名・リンクテキストから年号・回次・会議種別を解析
 *
 * ファイル名パターン例:
 *   "R7　第1回臨時会.pdf"
 *   "R7　第3回　定例会.pdf"
 *   "R7.4月　第4回臨時会　会議録.pdf"
 *   "R6.2月　第1回臨時会.pdf"
 *   "会議録　R6　第7回臨時会.pdf"
 */

import { LIST_PAGE_URL, BASE_URL, fetchPage, detectMeetingType, parseEraAbbr } from "./shared";

export interface OgimiMeeting {
  /** PDF の完全 URL */
  fileUrl: string;
  /** 会議タイトル（リンクテキスト or ファイル名ベース） */
  title: string;
  /** 西暦年（例: 2024）。解析できない場合は null */
  year: number | null;
  /** 会議タイプ */
  meetingType: string;
  /** 回次（例: 3）。解析できない場合は null */
  sessionNumber: number | null;
}

/**
 * ファイル名またはリンクテキストから回次を抽出する。
 *
 * パターン: "第3回" → 3
 */
function extractSessionNumber(text: string): number | null {
  const m = text.match(/第(\d+)回/);
  if (!m) return null;
  return parseInt(m[1]!, 10);
}

/**
 * ファイル名またはリンクテキストから年度を解析する。
 *
 * 試みる順序:
 *   1. "R7" / "H30" などの略称
 *   2. "令和7年" / "平成30年" の漢字表記
 */
function extractYear(text: string): number | null {
  // 略称パターン: R7, H30 など
  const abbrYear = parseEraAbbr(text);
  if (abbrYear !== null) return abbrYear;

  // 漢字表記: 令和7年, 平成30年, 令和元年
  const kanjiMatch = text.match(/(令和|平成)(元|\d+)年/);
  if (kanjiMatch) {
    const yearInEra = kanjiMatch[2] === "元" ? 1 : parseInt(kanjiMatch[2]!, 10);
    if (kanjiMatch[1] === "令和") return yearInEra + 2018;
    if (kanjiMatch[1] === "平成") return yearInEra + 1988;
  }

  return null;
}

/**
 * PDF URL のファイル名部分から会議タイトルを生成する。
 *
 * URL エンコードされたファイル名をデコードしてベースネームを返す。
 */
function titleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const encoded = pathname.split("/").pop() ?? "";
    const decoded = decodeURIComponent(encoded);
    // .pdf 拡張子を除去し、全角スペースを半角スペースに統一
    return decoded.replace(/\.pdf$/i, "").replace(/\u3000/g, " ").trim();
  } catch {
    return url;
  }
}

/**
 * 会議録一覧ページの HTML から PDF リンクとメタ情報を抽出する（純粋関数）。
 */
export function parseListPage(html: string): OgimiMeeting[] {
  const results: OgimiMeeting[] = [];

  // href が .pdf で終わる <a> タグを抽出
  const aPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(aPattern)) {
    const href = m[1]!;
    const rawText = m[2]!.replace(/<[^>]+>/g, "").trim();

    // URL を絶対パスに変換
    let fileUrl: string;
    try {
      fileUrl = href.startsWith("http") ? href : new URL(href, BASE_URL).toString();
    } catch {
      continue;
    }

    // ファイル名からタイトルを生成
    const filenameTitle = titleFromUrl(fileUrl);
    // リンクテキストが空ならファイル名ベースのタイトルを使用
    const title = rawText || filenameTitle;

    // 年度解析: リンクテキスト → ファイル名の順で試みる
    const year = extractYear(rawText) ?? extractYear(filenameTitle);

    // 回次解析
    const sessionNumber = extractSessionNumber(rawText) ?? extractSessionNumber(filenameTitle);

    // 会議タイプ: リンクテキストとファイル名の両方を考慮
    const combined = rawText + " " + filenameTitle;
    const meetingType = detectMeetingType(combined);

    results.push({
      fileUrl,
      title,
      year,
      meetingType,
      sessionNumber,
    });
  }

  return results;
}

/**
 * 会議録一覧ページから全 PDF リンクを取得し、指定年でフィルタする。
 */
export async function fetchDocumentList(year: number): Promise<OgimiMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) {
    console.warn(`[473022-ogimi] Failed to fetch list page: ${LIST_PAGE_URL}`);
    return [];
  }

  const all = parseListPage(html);
  return all.filter((m) => m.year === year);
}
