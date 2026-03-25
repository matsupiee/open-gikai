/**
 * 宿毛市議会 — list フェーズ
 *
 * 年別ページから PDF リンクとメタ情報を抽出する。
 *
 * ページ構造:
 * - 各年別ページ（/docs-06/{ID}.html）に PDF リンクが掲載されている
 * - PDF リンクのパス: /fs/{数字スラッシュ区切りのパス}/{ファイル名}.pdf
 * - リンクテキストに会議名・ファイル種別が記載される
 *   例: 「令和6年第1回臨時会会議録(令和6年1月開催)」等
 */

import { BASE_ORIGIN, buildYearPageUrl, eraToWesternYear, fetchPage } from "./shared";

export interface SukumoMeeting {
  pdfUrl: string;
  title: string;
  section: string;
  year: number;
  month: number | null;
  meetingSession: number;
  meetingKind: "定例会" | "臨時会";
}

/**
 * リンクテキストからメタ情報を抽出する。
 *
 * パターン例:
 *   "令和6年第1回臨時会会議録(令和6年1月開催)"
 *   "令和7年第2回定例会会議録"
 *   "平成17年第3回定例会"
 */
export function parseLinkText(linkText: string): {
  year: number;
  meetingSession: number;
  meetingKind: "定例会" | "臨時会";
  month: number | null;
} | null {
  // 年号・年・回次・種別の抽出
  const titlePattern = /^(令和|平成)(\d+|元)年第(\d+)回(定例会|臨時会)/;
  const titleMatch = linkText.match(titlePattern);
  if (!titleMatch) return null;

  const era = titleMatch[1]!;
  const eraYearStr = titleMatch[2]!;
  const meetingSession = parseInt(titleMatch[3]!, 10);
  const meetingKind = titleMatch[4] as "定例会" | "臨時会";

  const year = eraToWesternYear(era, eraYearStr);
  if (!year) return null;

  // 開催月の抽出（括弧内）
  const monthPattern = /(?:令和|平成)(?:\d+|元)年(\d+)月開催/;
  const monthMatch = linkText.match(monthPattern);
  const month = monthMatch ? parseInt(monthMatch[1]!, 10) : null;

  return { year, meetingSession, meetingKind, month };
}

/**
 * 年別ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 抽出条件:
 * - href が .pdf で終わるリンク
 * - リンクテキストが定例会・臨時会の会議録であること
 */
export function parseYearPage(html: string): SukumoMeeting[] {
  const results: SukumoMeeting[] = [];

  // a[href*=".pdf"] を抽出
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkHtml = match[2]!;
    const linkText = linkHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[\s　]+/g, " ")
      .trim();

    // メタ情報をパース
    const parsed = parseLinkText(linkText);
    if (!parsed) continue;

    // PDF URL を絶対 URL に変換
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    const section = `第${parsed.meetingSession}回 ${parsed.meetingKind}`;
    const title = linkText;

    results.push({
      pdfUrl,
      title,
      section,
      year: parsed.year,
      month: parsed.month,
      meetingSession: parsed.meetingSession,
      meetingKind: parsed.meetingKind,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<SukumoMeeting[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html);
}
