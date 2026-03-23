/**
 * 八郎潟町議会 -- list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. トップページから対象年度の年別一覧ページ URL を取得
 * 2. 年別一覧ページから各会議ページ URL を取得
 * 3. 各会議ページから PDF URL とメタ情報を抽出
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface HachirogataMeeting {
  pdfUrl: string;
  title: string;
  meetingPageUrl: string;
  meetingId: string;
}

/**
 * トップページから年別一覧ページのリンクを抽出する。
 * リンクパターン: ../../gikai/1001560/{yearId}/index.html
 * テキスト例: "令和6年八郎潟町議会議事録"
 */
export function parseTopPage(
  html: string,
  baseUrl: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*\/gikai\/1001560\/(\d+)\/index\.html)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[3]!.replace(/<[^>]+>/g, "").trim();

    if (!label.includes("議事録")) continue;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // relative path like ../../gikai/...
      const base = new URL(baseUrl);
      url = new URL(href, base).href;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * 年別一覧ページから各会議ページのリンクを抽出する。
 * リンクパターン: ../../../gikai/1001560/{yearId}/{meetingId}.html
 * テキスト例: "令和6年八郎潟町議会12月定例会議事録"
 */
export function parseYearPage(
  html: string,
  pageUrl: string,
): { label: string; url: string; meetingId: string }[] {
  const results: { label: string; url: string; meetingId: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*\/gikai\/1001560\/\d+\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const meetingId = match[2]!;
    const label = match[3]!.replace(/<[^>]+>/g, "").trim();

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      const base = new URL(pageUrl);
      url = new URL(href, base).href;
    }

    results.push({ label, url, meetingId });
  }

  return results;
}

/**
 * 会議ページから PDF URL を抽出する。
 * PDF リンクパターン: /_res/projects/default_project/_page_/xxx/xxx/xxx/filename.pdf
 */
export function parseMeetingPage(
  html: string,
  pageUrl: string,
): { pdfUrl: string; linkText: string } | null {
  const pdfLinkRegex =
    /<a[^>]+href="([^"]*\/_res\/projects\/default_project\/_page_\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i;

  const match = html.match(pdfLinkRegex);
  if (!match) return null;

  const href = match[1]!;
  const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

  let pdfUrl: string;
  if (href.startsWith("http")) {
    pdfUrl = href;
  } else if (href.startsWith("/")) {
    pdfUrl = `${BASE_ORIGIN}${href}`;
  } else {
    const base = new URL(pageUrl);
    pdfUrl = new URL(href, base).href;
  }

  return { pdfUrl, linkText };
}

/**
 * 指定年の全会議の PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HachirogataMeeting[]> {
  // Step 1: トップページから年別一覧ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml, baseUrl);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPages = yearPages.filter((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (targetPages.length === 0) return [];

  const meetings: HachirogataMeeting[] = [];

  for (const targetPage of targetPages) {
    // Step 2: 年別一覧ページから各会議ページ URL を取得
    const yearHtml = await fetchPage(targetPage.url);
    if (!yearHtml) continue;

    const meetingPages = parseYearPage(yearHtml, targetPage.url);

    // Step 3: 各会議ページから PDF URL を取得
    for (let i = 0; i < meetingPages.length; i++) {
      const mp = meetingPages[i]!;
      const meetingHtml = await fetchPage(mp.url);
      if (!meetingHtml) continue;

      const pdfInfo = parseMeetingPage(meetingHtml, mp.url);
      if (!pdfInfo) continue;

      meetings.push({
        pdfUrl: pdfInfo.pdfUrl,
        title: mp.label,
        meetingPageUrl: mp.url,
        meetingId: mp.meetingId,
      });

      // レート制限: 最後の1件ではスリープしない
      if (i < meetingPages.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  return meetings;
}
