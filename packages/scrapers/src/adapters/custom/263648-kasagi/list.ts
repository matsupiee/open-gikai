/**
 * 笠置町議会 会議録 -- list フェーズ
 *
 * トップページの左ナビから年度ページ URL を抽出し、
 * 年度ページに掲載された会議詳細ページを巡回して PDF 添付を収集する。
 */

import {
  buildDocumentUrl,
  buildListUrl,
  eraToWesternYear,
  fetchPage,
  normalizeWhitespace,
  stripTags,
} from "./shared";

export interface KasagiYearPage {
  label: string;
  url: string;
  year: number;
}

export interface KasagiMeetingLink {
  title: string;
  detailPageUrl: string;
}

export interface KasagiMeetingRecord {
  title: string;
  detailPageUrl: string;
  pdfUrl: string;
  linkLabel: string;
}

export function parseTopPage(html: string): KasagiYearPage[] {
  const results: KasagiYearPage[] = [];
  const seen = new Set<string>();

  const pattern =
    /<a[^>]+href="([^"]*bn_cd=5(?:&amp;|&)p_bn_cd=\d+[^"]*)"[^>]*>((?:令和|平成|昭和)[^<]+年)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const rawHref = match[1]!;
    const label = stripTags(match[2]!);
    const year = eraToWesternYear(label);
    if (year === null) continue;

    const url = buildDocumentUrl(rawHref.replace(/&amp;/g, "&"));
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ label, url, year });
  }

  return results;
}

export function parseYearPage(html: string): KasagiMeetingLink[] {
  const results: KasagiMeetingLink[] = [];

  const sectionMatch = html.match(/<div id="kakuka_right">([\s\S]*?)<\/div>/i);
  if (!sectionMatch) return results;

  const pattern =
    /<li>\s*<a href="([^"]*contents_detail\.php\?[^"]*frmId=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>(?:\s*<span class="date">\s*\[([^\]]+)\]\s*<\/span>)?\s*<\/li>/gi;

  for (const match of sectionMatch[1]!.matchAll(pattern)) {
    const rawHref = match[1]!;
    const title = stripTags(match[2]!);
    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    results.push({
      title,
      detailPageUrl: buildDocumentUrl(rawHref.replace(/&amp;/g, "&")),
    });
  }

  return results;
}

export function parseDetailPage(
  html: string,
  detailPageUrl: string,
  fallbackTitle: string,
): KasagiMeetingRecord[] {
  const pageTitle =
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") || fallbackTitle;

  const attachMatch = html.match(
    /<div class="mol_attachfileblock">([\s\S]*?)<\/div>/i,
  );
  if (!attachMatch) return [];

  const results: KasagiMeetingRecord[] = [];
  const seen = new Set<string>();
  const pattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of attachMatch[1]!.matchAll(pattern)) {
    const pdfUrl = new URL(match[1]!, detailPageUrl).toString();
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const rawLabel = stripTags(match[2]!)
      .replace(/\(ファイル名：[\s\S]*$/, "")
      .replace(/（ファイル名：[\s\S]*$/, "")
      .trim();

    results.push({
      title: pageTitle,
      detailPageUrl,
      pdfUrl,
      linkLabel: normalizeWhitespace(rawLabel),
    });
  }

  return results;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<KasagiMeetingRecord[]> {
  const listUrl = buildListUrl(baseUrl);
  const topHtml = await fetchPage(listUrl);
  if (!topHtml) return [];

  const yearPage = parseTopPage(topHtml).find((entry) => entry.year === year);
  if (!yearPage) return [];

  const yearHtml = await fetchPage(yearPage.url);
  if (!yearHtml) return [];

  const meetingLinks = parseYearPage(yearHtml);
  const records: KasagiMeetingRecord[] = [];

  for (const meetingLink of meetingLinks) {
    const detailHtml = await fetchPage(meetingLink.detailPageUrl);
    if (!detailHtml) continue;

    records.push(
      ...parseDetailPage(detailHtml, meetingLink.detailPageUrl, meetingLink.title),
    );
  }

  return records;
}
