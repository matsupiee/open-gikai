/**
 * 日吉津村議会 — list フェーズ
 *
 * 4階層で PDF リンクを収集する:
 * 1. トップページから年度別ページ URL を取得
 * 2. 年度ページから会議一覧を取得
 * 3. 会議ページから議事区分（提案説明、一般質問等）を取得
 * 4. 議事区分ページから PDF リンクを取得
 *
 * 日吉津村 CMS のリンク構造:
 *   <a href="/list/gikai/y446/.../" class="index">
 *     <div class="main_area"><p class="title">令和7年</p></div>
 *   </a>
 * テキストは <p class="title"> 内に格納されているため、
 * アンカー内を [\s\S]*? で取得し、タイトルタグからテキストを抽出する。
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface HiezuMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
  meetingName: string;
}

/**
 * アンカータグの内部 HTML からテキストを抽出する。
 * <p class="title"> があればそこから、なければ全タグを除去して取得する。
 */
function extractLinkText(innerHtml: string): string {
  const titleMatch = innerHtml.match(/<p[^>]*class="title"[^>]*>([\s\S]*?)<\/p>/);
  if (titleMatch) {
    return titleMatch[1]!.replace(/<[^>]+>/g, "").trim();
  }
  return innerHtml.replace(/<[^>]+>/g, "").trim();
}

/**
 * トップページから年度別ページのリンクを抽出する。
 * リンクテキスト例: "令和7年", "平成31年・令和元年"
 */
export function parseTopPage(
  html: string
): { label: string; path: string }[] {
  const results: { label: string; path: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\/list\/gikai\/y446\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = extractLinkText(match[2]!);

    // 年度リンクのみ（令和/平成を含むもの）
    if (!/(令和|平成)/.test(label)) continue;

    results.push({ label, path: href });
  }

  return results;
}

/**
 * 年度ページから会議一覧のリンクを抽出する。
 * リンクテキスト例: "令和6年第４回定例会（令和６年１２月）"
 */
export function parseYearPage(
  html: string,
  yearPath: string
): { label: string; path: string }[] {
  const results: { label: string; path: string }[] = [];

  const basePath = yearPath.endsWith("/") ? yearPath : `${yearPath}/`;

  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = extractLinkText(match[2]!);

    // 定例会・臨時会リンクのみ
    if (!/(定例会|臨時会)/.test(label)) continue;

    // basePath 配下のリンクか確認
    if (!href.startsWith(basePath)) continue;

    results.push({ label, path: href });
  }

  return results;
}

/**
 * 会議ページから議事区分のリンクを抽出する。
 * リンクテキスト例: "提案説明", "一般質問", "議案質疑", "討論・採決"
 */
export function parseMeetingPage(
  html: string,
  meetingPath: string
): { label: string; path: string }[] {
  const results: { label: string; path: string }[] = [];

  const basePath = meetingPath.endsWith("/") ? meetingPath : `${meetingPath}/`;

  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = extractLinkText(match[2]!);

    // 議事区分ページへのリンク（会議ページ配下のサブページ）
    if (!href.startsWith(basePath)) continue;
    // 自分自身やパンくずのリンクを除外
    if (href === meetingPath || href === basePath) continue;

    results.push({ label, path: href });
  }

  return results;
}

/**
 * 議事区分ページから PDF リンクを抽出する。
 * PDF URL パターン: /user/filer_public/{hash1}/{hash2}/{uuid}/{filename}.pdf
 * リンクテキスト例: "令和６年１２月３日初日 (843.7 KB)"
 */
export function parseSectionPage(
  html: string
): { pdfUrl: string; linkText: string }[] {
  const results: { pdfUrl: string; linkText: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    // HTML タグを除去してテキストのみ取得
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ pdfUrl, linkText });
  }

  return results;
}

/**
 * PDF リンクテキストから開催日を抽出する。
 * e.g., "令和６年１２月３日初日 (843.7 KB)" → "2024-12-03"
 *
 * 全角数字にも対応する。
 */
export function parseDateFromLinkText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<HiezuMeeting[]> {
  // Step 1: トップページから年度別ページのリンクを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPages = yearPages.filter((p) =>
    eraTexts.some((era) => p.label.includes(era))
  );
  if (targetPages.length === 0) return [];

  const allMeetings: HiezuMeeting[] = [];

  for (const targetPage of targetPages) {
    // Step 2: 年度ページから会議一覧を取得
    const yearUrl = `${BASE_ORIGIN}${targetPage.path}`;
    const yearHtml = await fetchPage(yearUrl);
    if (!yearHtml) continue;

    const meetings = parseYearPage(yearHtml, targetPage.path);

    for (let mi = 0; mi < meetings.length; mi++) {
      const meeting = meetings[mi]!;
      // Step 3: 会議ページから議事区分を取得
      const meetingUrl = `${BASE_ORIGIN}${meeting.path}`;
      const meetingHtml = await fetchPage(meetingUrl);
      if (!meetingHtml) continue;

      const sections = parseMeetingPage(meetingHtml, meeting.path);

      for (let si = 0; si < sections.length; si++) {
        const section = sections[si]!;
        // Step 4: 議事区分ページから PDF リンクを取得
        const sectionUrl = `${BASE_ORIGIN}${section.path}`;
        const sectionHtml = await fetchPage(sectionUrl);
        if (!sectionHtml) continue;

        const pdfs = parseSectionPage(sectionHtml);

        for (const pdf of pdfs) {
          const heldOn = parseDateFromLinkText(pdf.linkText);
          if (!heldOn) continue;

          // タイトル: 会議名 + 議事区分
          const title = `${meeting.label} ${section.label}`;

          allMeetings.push({
            pdfUrl: pdf.pdfUrl,
            title,
            heldOn,
            section: section.label,
            meetingName: meeting.label,
          });
        }

        if (si < sections.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (mi < meetings.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  return allMeetings;
}
