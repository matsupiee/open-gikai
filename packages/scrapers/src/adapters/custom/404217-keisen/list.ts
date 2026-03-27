/**
 * 桂川町議会 会議録 — list フェーズ
 *
 * 単一ページの年度見出しごとに PDF リンクが並んでいる。
 *
 * 例:
 *   <h2>令和7年</h2>
 *   <ul class="pdf">
 *     <li><a href="../pdf/gikai/kaigiroku_250305.pdf">令和7年第1回桂川町議会定例会（3月5日）（PDFファイル：2,001KB）</a></li>
 *   </ul>
 */

import {
  LIST_PAGE_URL,
  collapseWhitespace,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  resolveUrl,
  toHalfWidth,
} from "./shared";

export interface KeisenMeeting {
  title: string;
  pdfUrl: string;
  heldOn: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  headingYear: number;
}

/** リンク文言から PDF サイズ表記を除去する */
export function cleanLinkText(text: string): string {
  return collapseWhitespace(
    text.replace(/（PDFファイル[:：][^）]+）/g, "").trim(),
  );
}

/** リンク文言と年度見出しから開催日を構築する */
export function parseHeldOn(text: string, headingYear: number): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  return `${headingYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する。
 * h2 見出しを順番に追いながら、対象年度の a[href$=".pdf"] を拾う。
 */
export function parseListPage(
  html: string,
  filterYear?: number,
): KeisenMeeting[] {
  const results: KeisenMeeting[] = [];

  const tokenPattern =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentYear: number | null = null;

  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(html)) !== null) {
    if (match[1] !== undefined) {
      const headingText = collapseWhitespace(
        match[1].replace(/<[^>]+>/g, " ").trim(),
      );
      currentYear = parseWarekiYear(headingText);
      continue;
    }

    if (match[2] === undefined || match[3] === undefined || currentYear === null) {
      continue;
    }

    if (filterYear !== undefined && currentYear !== filterYear) continue;

    const cleanText = cleanLinkText(match[3].replace(/<[^>]+>/g, " "));
    if (!cleanText) continue;

    const heldOn = parseHeldOn(cleanText, currentYear);
    if (!heldOn) continue;

    results.push({
      title: cleanText,
      pdfUrl: resolveUrl(match[2].trim()),
      heldOn,
      meetingType: detectMeetingType(cleanText),
      headingYear: currentYear,
    });
  }

  return results;
}

/** 指定年の会議一覧を取得する */
export async function fetchMeetingList(year: number): Promise<KeisenMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
