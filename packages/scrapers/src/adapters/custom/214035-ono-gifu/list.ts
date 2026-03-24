/**
 * 岐阜県大野町議会 — list フェーズ
 *
 * 「議会だより（一般質問）」ページから各定例会の一般質問 PDF リンクを収集する。
 *
 * 手順:
 * 1. 議会トップページから「議会だより（一般質問）」の年度別ページ URL を収集
 * 2. 対象年の年度別ページから PDF リンクを抽出
 *
 * 年度別ページの構造:
 *   <a href="./cmsfiles/contents/0000002/2406/r07ippansitumon1.pdf">令和7年第1回定例会</a>
 *   <a href="./cmsfiles/contents/0000002/2406/r07ippansitumon2.pdf">令和7年第2回定例会</a>
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  detectMeetingType,
  fetchPage,
  resolveUrl,
} from "./shared";

export interface OnoGifuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第1回定例会"） */
  title: string;
  /** meetingType: "plenary" | "extraordinary" */
  meetingType: string;
  /** 年度ページの URL（externalId 生成に使用） */
  sourcePageUrl: string;
  /**
   * 開催日 YYYY-MM-DD。
   * PDF リンクテキストには日付がないため null になる場合がある。
   */
  heldOn: string | null;
}

/**
 * 議会トップページの HTML から「議会だより（一般質問）」の年度別ページ URL を抽出する。
 *
 * リンクテキストが "議会だより（一般質問・" を含むリンクを対象とする。
 */
export function parseTopPageForNewsletterLinks(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const text = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!text.includes("議会だより") || !text.includes("一般質問")) continue;

    const url = href.startsWith("http")
      ? href
      : href.startsWith("/")
        ? `${BASE_ORIGIN}${href}`
        : `${BASE_ORIGIN}/${href}`;

    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ label: text, url });
  }

  return results;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * PDF リンクのテキストは "令和X年第N回定例会" 形式。
 * 対象年（西暦）でフィルタリングする。
 */
export function parseNewsletterPage(
  html: string,
  pageUrl: string,
  targetYear: number
): OnoGifuMeeting[] {
  const results: OnoGifuMeeting[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 定例会・臨時会のリンクのみ対象
    if (!/第\d+回(?:定例会|臨時会)/.test(rawText)) continue;

    // タイトルの "令和X年" から西暦を計算してフィルタリング
    const eraMatch = rawText.match(/(令和|平成)(元|\d+)年/);
    if (!eraMatch) continue;

    const era = eraMatch[1]!;
    const eraYearStr = eraMatch[2]!;
    const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else continue;

    if (westernYear !== targetYear) continue;

    const pdfUrl = resolveUrl(href, pageUrl);

    results.push({
      pdfUrl,
      title: rawText,
      meetingType: detectMeetingType(rawText),
      sourcePageUrl: pageUrl,
      heldOn: null,
    });
  }

  return results;
}

/**
 * 指定年の一般質問 PDF リンク一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<OnoGifuMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const newsletterLinks = parseTopPageForNewsletterLinks(topHtml);
  if (newsletterLinks.length === 0) return [];

  for (const link of newsletterLinks) {
    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) continue;

    const meetings = parseNewsletterPage(pageHtml, link.url, year);
    if (meetings.length > 0) {
      return meetings;
    }
  }

  return [];
}
