/**
 * 天城町議会 会議録 — list フェーズ
 *
 * 単一の一覧ページから年度別・会議別の PDF リンクを収集する。
 *
 * HTML 構造:
 *   <tr>
 *     <td colspan="2"><strong>令和６年 議事録</strong></td>
 *   </tr>
 *   <tr>
 *     <td rowspan="5">第４回天城町定例会</td>
 *     <td><a href="/fs/.../R6...pdf">R6天城町4定(1号)12月5日 (PDF 1.05MB)</a></td>
 *   </tr>
 *
 * - 年度は「令和X年 議事録」の行で切り替わる
 * - 会議名は rowspanned な先頭セルから継承する
 * - 「目次」「会期日程」「日程」は発言データを持たないため除外する
 */

import {
  BASE_ORIGIN,
  BASE_URL,
  detectMeetingType,
  fetchPage,
  parseEraYear,
  parseMonthDay,
} from "./shared";

export interface AmagiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingType: string;
  session: string;
}

const SKIP_PATTERNS = [/目次/, /会期日程/, /日程/];

function decodeHtmlText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return decodeHtmlText(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function buildTitle(session: string, linkText: string): string {
  const normalized = stripTags(linkText);
  const date = parseMonthDay(normalized);
  const issueMatch = normalized.match(/[（(]\s*([０-９\d]+号)\s*[）)]/);
  const parts = [session || normalized];

  if (issueMatch) {
    parts.push(issueMatch[1]!.replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0),
    ));
  }

  if (date) {
    parts.push(`${date.month}月${date.day}日`);
  }

  return parts.join(" ").trim();
}

/**
 * 一覧ページ HTML から指定年の会議 PDF を抽出する。
 */
export function parseListPage(html: string, year: number): AmagiMeeting[] {
  const results: AmagiMeeting[] = [];
  const seen = new Set<string>();

  let currentYear: number | null = null;
  let currentSession = "";

  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[1]!;
    const rowText = stripTags(rowHtml);

    const rowYear = parseEraYear(rowText);
    if (rowYear) {
      currentYear = rowYear;
      currentSession = "";
      continue;
    }

    if (currentYear !== year) continue;

    const cellMatches = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length > 0) {
      const sessionCandidate = stripTags(cellMatches[0]![1]!);
      if (
        sessionCandidate &&
        /(?:定例会|臨時会|委員会|協議会)/.test(sessionCandidate) &&
        !sessionCandidate.includes(".pdf")
      ) {
        currentSession = sessionCandidate;
      }
    }

    const linkMatch = rowHtml.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const href = linkMatch[1]!;
    const linkText = stripTags(linkMatch[2]!);
    if (!linkText) continue;
    if (SKIP_PATTERNS.some((pattern) => pattern.test(linkText))) continue;

    const date = parseMonthDay(linkText);
    if (!date) continue;

    const pdfUrl = new URL(href, `${BASE_ORIGIN}/`).toString();
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    results.push({
      pdfUrl,
      title: buildTitle(currentSession, linkText),
      heldOn: `${year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`,
      meetingType: detectMeetingType(currentSession || linkText),
      session: currentSession,
    });
  }

  return results;
}

/**
 * 指定年の会議 PDF 一覧を取得する。
 */
export async function fetchDocumentList(year: number): Promise<AmagiMeeting[]> {
  const html = await fetchPage(BASE_URL);
  if (!html) {
    console.warn(`[465313-amagi] Failed to fetch list page: ${BASE_URL}`);
    return [];
  }

  return parseListPage(html, year);
}
