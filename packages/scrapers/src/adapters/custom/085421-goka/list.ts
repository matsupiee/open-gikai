/**
 * 五霞町議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. 一覧ページから対象年度のサブページ URL を取得
 * 2. 年度サブページから個別会議ページ URL を取得
 * 3. 各会議ページから会議録 PDF リンクを取得
 */

import { BASE_ORIGIN, eraToWesternYear, fetchPage, toJapaneseEra } from "./shared";

export interface GokaMeeting {
  /** 会議タイトル（例: "令和7年第4回定例会"） */
  title: string;
  /** 会議ページの URL */
  pageUrl: string;
  /** 会議録 PDF の URL 一覧（目次と審議結果を除く） */
  pdfUrls: string[];
}

/**
 * 一覧ページから年度別サブページのリンクを抽出する。
 * リンクテキストが「令和N年」「平成N年」にマッチするもの。
 */
export function parseTopPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    // 年度ラベル: 「令和N年」or「平成N年」（会議録リンクではなく年度ナビ）
    if (!/(令和|平成)(元|\d+)年/.test(label)) continue;
    // 会議名が含まれる場合はスキップ（年度ナビのみ抽出）
    if (label.includes("定例会") || label.includes("臨時会")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // 重複排除
    if (!results.some((r) => r.url === url)) {
      results.push({ label, url });
    }
  }

  return results;
}

/**
 * 年度サブページから個別会議ページのリンクを抽出する。
 */
export function parseYearPage(
  html: string,
): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*page\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.trim();

    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (!results.some((r) => r.url === url)) {
      results.push({ title, url });
    }
  }

  return results;
}

/**
 * 会議ページから会議録 PDF のリンクを抽出する。
 * 審議結果 PDF（doc_36）と目次は除外し、会議録本文の PDF（doc_88）のみ返す。
 */
export function parseMeetingPage(
  html: string,
): string[] {
  const pdfUrls: string[] = [];

  const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 審議結果 PDF（doc_36）をスキップ
    if (href.includes("doc_36")) continue;
    // 目次をスキップ
    if (/目次/i.test(linkText)) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (!pdfUrls.includes(url)) {
      pdfUrls.push(url);
    }
  }

  return pdfUrls;
}

/**
 * 会議タイトルから開催年（西暦）を抽出する。
 * e.g., "令和7年第4回定例会" → 2025
 */
export function extractYearFromTitle(title: string): number | null {
  const match = title.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<GokaMeeting[]> {
  // Step 1: 一覧ページから年度別サブページを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のサブページを見つける
  const targetPages = yearPages.filter((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (targetPages.length === 0) return [];

  // Step 2: 年度サブページから個別会議ページリンクを取得
  const meetingLinks: { title: string; url: string }[] = [];
  for (const page of targetPages) {
    const yearHtml = await fetchPage(page.url);
    if (!yearHtml) continue;
    const links = parseYearPage(yearHtml);
    // 対象年の会議のみフィルタ
    for (const link of links) {
      const meetingYear = extractYearFromTitle(link.title);
      if (meetingYear === year && !meetingLinks.some((m) => m.url === link.url)) {
        meetingLinks.push(link);
      }
    }
  }

  // Step 3: 各会議ページから PDF リンクを取得
  const meetings: GokaMeeting[] = [];
  for (let i = 0; i < meetingLinks.length; i++) {
    const link = meetingLinks[i]!;
    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) continue;

    const pdfUrls = parseMeetingPage(pageHtml);
    if (pdfUrls.length > 0) {
      meetings.push({
        title: link.title,
        pageUrl: link.url,
        pdfUrls,
      });
    }

    if (i < meetingLinks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return meetings;
}
