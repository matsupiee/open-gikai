/**
 * 日野町議会（滋賀県）— list フェーズ
 *
 * トップページには各年の記事ページリンクが並び、
 * 各記事ページに日別の会議録 PDF が掲載されている。
 */

import {
  INDEX_URL,
  detectMeetingType,
  extractHeldOnFromPdf,
  extractYearFromTitle,
  fetchPage,
  resolveUrl,
} from "./shared";

export interface HinoShigaMeetingRecord {
  sessionTitle: string;
  pdfUrl: string;
  linkText: string;
  meetingType: string;
  heldOn: string | null;
  detailPageUrl: string;
}

/**
 * トップページ HTML から記事ページ URL とタイトルを抽出する。
 *
 * `/{7,10桁}.html` の記事リンクのみを対象とし、
 * タイトルに「会議録」を含むものだけを収集する。
 */
export function parseIndexPage(html: string): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const title = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title.includes("会議録")) continue;
    if (!/(?:^|\/)\d{7,10}\.html(?:\?[^"]*)?$/i.test(href)) continue;

    const url = resolveUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ url, title });
  }

  return results;
}

/** 会議録 PDF かどうか判定する */
export function isMeetingMinutes(linkText: string, pdfUrl: string): boolean {
  if (linkText.includes("目次")) return false;
  if (/mokuji\.pdf$/i.test(pdfUrl)) return false;
  if (/kaigiroku\.pdf$/i.test(pdfUrl)) return true;
  if (linkText.includes("会議録")) return true;
  if (/第[0-9０-９一二三四五六七八九十]+日/.test(linkText)) return true;
  return false;
}

/**
 * 記事ページ HTML から会議録 PDF リンクを抽出する。
 */
export function parseDetailPage(
  html: string,
  sessionTitle: string,
  detailPageUrl: string,
): HinoShigaMeetingRecord[] {
  const results: HinoShigaMeetingRecord[] = [];
  const blockPattern =
    /<div[^>]*class="mol_attachfileblock[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  for (const blockMatch of html.matchAll(blockPattern)) {
    const blockHtml = blockMatch[1]!;
    const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of blockHtml.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const rawLinkText = linkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\(サイズ：[^)]*\)/g, "")
        .replace(/\.pdf$/i, "")
        .replace(/\s+/g, " ")
        .trim();

      const pdfUrl = resolveUrl(href);
      if (!isMeetingMinutes(rawLinkText, pdfUrl)) continue;

      results.push({
        sessionTitle,
        pdfUrl,
        linkText: rawLinkText,
        meetingType: detectMeetingType(sessionTitle),
        heldOn: extractHeldOnFromPdf(pdfUrl, rawLinkText, sessionTitle),
        detailPageUrl,
      });
    }
  }

  return results;
}

export function extractYearFromHeldOn(heldOn: string | null): number | null {
  if (!heldOn) return null;
  const match = heldOn.match(/^(\d{4})-/);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

/** トップページから記事ページ一覧を取得する */
export async function fetchDetailPageEntries(): Promise<
  Array<{ url: string; title: string }>
> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return [];
  return parseIndexPage(html);
}

/** 指定年の会議録 PDF リンクを収集する */
export async function fetchMeetingRecords(
  year: number,
): Promise<HinoShigaMeetingRecord[]> {
  const entries = await fetchDetailPageEntries();
  if (entries.length === 0) return [];

  const allRecords: HinoShigaMeetingRecord[] = [];

  for (const entry of entries) {
    const titleYear = extractYearFromTitle(entry.title);
    if (titleYear !== null && titleYear !== year) continue;

    const html = await fetchPage(entry.url);
    if (!html) continue;

    const records = parseDetailPage(html, entry.title, entry.url);
    for (const record of records) {
      const recordYear = extractYearFromHeldOn(record.heldOn);
      const fallbackYear = extractYearFromTitle(record.sessionTitle);
      const effectiveYear = recordYear ?? fallbackYear;
      if (effectiveYear === year) {
        allRecords.push(record);
      }
    }
  }

  return allRecords;
}
