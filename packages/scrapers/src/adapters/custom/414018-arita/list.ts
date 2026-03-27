/**
 * 有田町議会 会議録 -- list フェーズ
 *
 * 1. 会議録トップ (`list00404.html`) から年別ページ URL を取得
 * 2. 各年別ページのメタリフレッシュ先 (`detail.aspx`) を解決
 * 3. 詳細ページの `h3` と表から一般質問 PDF を抽出
 */

import {
  buildDocumentUrl,
  buildListUrl,
  detectMeetingType,
  fetchPage,
} from "./shared";

export interface AritaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingType: string;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(html: string): string {
  return decodeHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function eraToWestern(era: string, eraYearText: string): number {
  const eraYear = eraYearText === "元" ? 1 : parseInt(eraYearText, 10);
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return eraYear;
}

function parseHeldOn(dateText: string, year: number): string | null {
  const normalized = stripTags(dateText);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会議録トップ HTML から年度別ページ URL を抽出する。
 *
 * ナビゲーション `g_navi_404` が「会議録・定例会」に対応しており、
 * 同じ年の「議会だより」リンクと混同しないようにこのブロックだけを見る。
 */
export function parseIndexPage(
  html: string
): { year: number; url: string }[] {
  const navBlock =
    html.match(/<ul[^>]*id="g_navi_404"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? html;

  const results: { year: number; url: string }[] = [];
  const seen = new Set<number>();
  const linkPattern =
    /<a\s[^>]*href="([^"]*\/gikai\/list\d+\.html)"[^>]*>\s*([12]\d{3})\s*<\/a>/gi;

  for (const match of navBlock.matchAll(linkPattern)) {
    const href = decodeHtml(match[1]!);
    const year = parseInt(match[2]!, 10);
    if (seen.has(year)) continue;

    seen.add(year);
    results.push({
      year,
      url: buildDocumentUrl(href),
    });
  }

  return results;
}

/**
 * 年度別ページ HTML に埋め込まれたリダイレクト先 URL を抽出する。
 *
 * `list00984.html` のような年別ページ自体は空で、meta refresh または
 * `location.href` で `detail.aspx` に遷移する。
 */
export function parseRedirectUrl(html: string): string | null {
  const metaRefreshMatch = html.match(
    /<meta[^>]+http-equiv="refresh"[^>]+content="[^"]*url=([^"]+)"/i
  );
  if (metaRefreshMatch) {
    return buildDocumentUrl(decodeHtml(metaRefreshMatch[1]!));
  }

  const locationMatch = html.match(/location\.href='([^']+)'/i);
  if (locationMatch) {
    return buildDocumentUrl(decodeHtml(locationMatch[1]!));
  }

  return null;
}

/**
 * 詳細ページ HTML から一般質問 PDF を抽出する。
 *
 * 各定例会/臨時会セクションは `h3` で始まり、その下の表に
 * 「月日 / 摘要（会議録）」として日別 PDF が並ぶ。
 * 「会期日程」PDF は表の外にあるため、自動的に除外される。
 */
export function parseYearPage(html: string): AritaMeeting[] {
  const articleHtml = html.match(/<article>[\s\S]*?<\/article>/i)?.[0] ?? html;
  const meetings: AritaMeeting[] = [];
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const h3Matches = [...articleHtml.matchAll(h3Pattern)];

  for (let i = 0; i < h3Matches.length; i++) {
    const current = h3Matches[i]!;
    const heading = stripTags(current[1]!);
    const sessionMatch = heading.match(
      /(令和|平成)(元|\d+)年\s*\d{1,2}月\s*第(\d+)回有田町議会(定例会|臨時会|委員会)/
    );
    if (!sessionMatch) continue;

    const westernYear = eraToWestern(sessionMatch[1]!, sessionMatch[2]!);
    const sessionNumber = sessionMatch[3]!;
    const sessionLabel = sessionMatch[4]!;
    const meetingType = detectMeetingType(sessionLabel);
    const titlePrefix = `第${sessionNumber}回${sessionLabel}`;

    const start = current.index! + current[0].length;
    const end =
      i + 1 < h3Matches.length ? h3Matches[i + 1]!.index! : articleHtml.length;
    const sectionHtml = articleHtml.slice(start, end);

    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let dayNumber = 0;

    for (const rowMatch of sectionHtml.matchAll(rowPattern)) {
      const rowHtml = rowMatch[1]!;
      const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
        (cellMatch) => cellMatch[1]!
      );

      if (cells.length < 2) continue;

      const heldOn = parseHeldOn(cells[0]!, westernYear);
      if (!heldOn) continue;

      const pdfMatch = cells[1]!.match(
        /<a\s[^>]*href="([^"]+\.pdf(?:\?[^"]*)?)"[^>]*>/i
      );
      if (!pdfMatch) continue;

      dayNumber += 1;
      meetings.push({
        pdfUrl: buildDocumentUrl(decodeHtml(pdfMatch[1]!)),
        title: `${titlePrefix} 第${dayNumber}日`,
        heldOn,
        meetingType,
      });
    }
  }

  return meetings;
}

/**
 * 指定年の会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<AritaMeeting[]> {
  const indexHtml = await fetchPage(buildListUrl());
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const targetPage = yearPages.find((page) => page.year === year);
  if (!targetPage) return [];

  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  const redirectUrl = parseRedirectUrl(yearHtml);
  const detailHtml = redirectUrl ? await fetchPage(redirectUrl) : yearHtml;
  if (!detailHtml) return [];

  return parseYearPage(detailHtml);
}
