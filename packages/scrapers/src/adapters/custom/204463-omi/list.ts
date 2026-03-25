/**
 * 麻績村議会 — list フェーズ
 *
 * gikaijimukyoku536.html の 1 ページから全 PDF リンクを収集する。
 *
 * HTML 構造:
 *   <div class="c-entry-body">
 *     <h2>令和7年議事録</h2>
 *     <ul class="c-list-horizontal">
 *       <li><a href="/files/gikaijimukyoku/令和７年第１回定例会.pdf">3月定例会　議事録 (1.5MB)</a></li>
 *     </ul>
 *     <h2>令和6年議事録</h2>
 *     ...
 *   </div>
 */

import { BASE_ORIGIN, LIST_URL, detectMeetingType, fetchPage, parseWarekiYear } from "./shared";

export interface OmiPdfRecord {
  /** 会議タイトル（例: "令和7年3月定例会"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 西暦年 */
  year: number;
}

/**
 * 全角数字を半角数字に変換する。
 */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * href を絶対 URL に変換する。
 */
function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  // URL エンコードが必要なパスはそのまま扱う（ブラウザが処理する）
  const path = href.startsWith("/") ? href : `/${href}`;
  return `${BASE_ORIGIN}${path}`;
}

/**
 * リンクテキストから会議名を抽出する。
 * 例: "3月定例会　議事録 (1.5MB)" → "3月定例会"
 * 例: "第1回臨時会　議事録 (215.9KB)" → "第1回臨時会"
 */
export function parseSessionName(linkText: string): string | null {
  const normalized = toHalfWidth(linkText).trim();
  const match = normalized.match(
    /^(\d+月(?:定例会|臨時会)|第\d+回(?:定例会|臨時会))[\s　]/,
  );
  if (match?.[1]) return match[1];
  return null;
}

/**
 * h2 テキストから年度テキストを抽出する。
 * 例: "令和7年議事録" → "令和7年"
 */
export function parseYearFromHeading(heading: string): string | null {
  const normalized = toHalfWidth(heading).trim();
  const match = normalized.match(/^((?:令和|平成|昭和)(?:元|\d+)年)/);
  return match?.[1] ?? null;
}

/**
 * gikaijimukyoku536.html の HTML から PDF レコード一覧をパースする。
 *
 * div.c-entry-body 内の h2 タグで年度ブロックを特定し、
 * 直後の ul 内の a タグから PDF の href とリンクテキストを抽出する。
 */
export function parseListPage(html: string): OmiPdfRecord[] {
  const records: OmiPdfRecord[] = [];

  // div.c-entry-body のコンテンツを抽出
  const bodyMatch = html.match(/<div[^>]+class="[^"]*c-entry-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1]! : html;

  // h2 タグで年度ブロックに分割
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/gi;

  for (const sectionMatch of bodyHtml.matchAll(h2Regex)) {
    const headingRaw = sectionMatch[1]!.replace(/<[^>]+>/g, "").trim();
    const sectionHtml = sectionMatch[2]!;

    const yearText = parseYearFromHeading(headingRaw);
    if (!yearText) continue;

    const year = parseWarekiYear(yearText);
    if (!year) continue;

    // a タグから PDF リンクを抽出（.pdf で終わる href）
    const linkRegex = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const linkMatch of sectionHtml.matchAll(linkRegex)) {
      const href = linkMatch[1]!;
      const rawText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      const sessionName = parseSessionName(rawText);
      if (!sessionName) continue;

      const pdfUrl = toAbsoluteUrl(href);
      const title = `${yearText}${sessionName}`;

      records.push({
        title,
        pdfUrl,
        meetingType: detectMeetingType(sessionName),
        year,
      });
    }
  }

  return records;
}

/**
 * gikaijimukyoku536.html を取得して指定年の PDF レコード一覧を返す。
 */
export async function fetchPdfList(year: number): Promise<OmiPdfRecord[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allRecords = parseListPage(html);
  return allRecords.filter((r) => r.year === year);
}
