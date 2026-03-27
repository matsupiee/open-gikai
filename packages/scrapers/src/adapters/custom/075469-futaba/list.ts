/**
 * 双葉町議会 会議録 — list フェーズ
 *
 * トップページから年度別ページを取得し、対象年度ページ上の PDF リンクを収集する。
 * 年度ページは i-SITE PORTAL の静的 HTML で、本文中に PDF リンクが直接並ぶ。
 */

import { extractYearsFromLabel, fetchPage, toAbsoluteUrl } from "./shared";

export interface FutabaYearPage {
  label: string;
  url: string;
  years: number[];
}

export interface FutabaMeeting {
  title: string;
  pdfUrl: string;
  yearPageUrl: string;
}

/**
 * トップページ HTML から年度別ページリンクを抽出する。
 */
export function parseTopPage(html: string): FutabaYearPage[] {
  const pages: FutabaYearPage[] = [];
  const seen = new Set<string>();
  const linkRegex = /<a\s[^>]*href="([^"]+\.htm)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!label.includes("会議録")) continue;

    const url = toAbsoluteUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);

    pages.push({
      label,
      url,
      years: extractYearsFromLabel(label),
    });
  }

  return pages;
}

function stripFileSize(text: string): string {
  return text.replace(/[（(]\s*[\d.]+\s*(?:K|M)B\s*[）)]$/i, "").trim();
}

/**
 * 年度別ページ HTML から PDF リンク一覧を抽出する。
 * 同一 PDF への分割リンクはテキストを結合して 1 件にまとめる。
 */
export function parseYearPage(html: string, pageUrl: string): FutabaMeeting[] {
  const links = new Map<string, string>();
  const linkRegex = /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = toAbsoluteUrl(match[1]!, pageUrl);
    const text = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) continue;

    const prev = links.get(href);
    if (!prev) {
      links.set(href, text);
      continue;
    }

    if (prev.includes(text)) continue;
    if (text.includes(prev)) {
      links.set(href, text);
      continue;
    }

    links.set(href, `${prev}${text}`.replace(/\s+/g, " ").trim());
  }

  return [...links.entries()]
    .map(([pdfUrl, rawTitle]) => ({
      title: stripFileSize(rawTitle),
      pdfUrl,
      yearPageUrl: pageUrl,
    }))
    .filter((meeting) => meeting.title.length > 0);
}

/**
 * 指定年の年度別ページを巡回して PDF リンクを返す。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<FutabaMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const targetPage = yearPages.find((page) => page.years.includes(year));
  if (!targetPage) return [];

  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, targetPage.url);
}
