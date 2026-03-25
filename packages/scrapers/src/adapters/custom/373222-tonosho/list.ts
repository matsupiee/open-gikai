/**
 * 土庄町議会 — list フェーズ
 *
 * 2種類のフォーマットに対応する:
 *
 * 新フォーマット（令和3年〜令和7年）: 3層構造
 *   1. reiwa{N}/index.html から会議別ページへのリンクを収集
 *   2. 会議別ページ（{N}_{月}gatu.html）から PDF リンクを収集
 *      - h2「全文」配下: 会議録全文 PDF
 *      - h2「一般質問」配下: 議員名ごとの一般質問 PDF
 *      - h2「委員長報告」「閉会中の委員会活動報告」配下: 委員会報告 PDF
 *
 * 旧フォーマット（令和2年以前）: 2層構造
 *   1. {数字ID}.html に直接 h3 + PDF リンクが含まれる
 */

import {
  BASE_ORIGIN,
  LEGACY_YEAR_URLS,
  fetchPage,
  buildHeldOn,
  detectMeetingType,
  toAbsoluteUrl,
} from "./shared";

export interface TonoshoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingName: string;
  year: number;
}

/** 会議種別を表すテキストから月を抽出 */
function extractMonthFromText(text: string): number | null {
  const m = text.match(/(\d{1,2})月/);
  return m ? parseInt(m[1]!, 10) : null;
}

/**
 * 新フォーマット: reiwa{N}/index.html から会議別ページリンクを抽出する。
 *
 * HTML 構造:
 *   <ul><li><a href="{N}_{月}gatu.html">{月}月{定例会|臨時会}の会議録</a></li></ul>
 */
export function parseReiwaIndexPage(
  html: string,
  indexPageUrl: string
): { url: string; meetingName: string }[] {
  const results: { url: string; meetingName: string }[] = [];

  const linkPattern =
    /<a[^>]+href="([^"]+\.html)"[^>]*>\s*([^<]*(?:定例会|臨時会)[^<]*)\s*<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    const url = toAbsoluteUrl(href, indexPageUrl);
    results.push({ url, meetingName: linkText });
  }

  return results;
}

/**
 * 新フォーマット: 会議別ページから PDF リンクを分類して収集する。
 *
 * HTML 構造:
 *   h1: 「{月}月{定例会|臨時会}の会議録」
 *   h2: 「全文」
 *     h3: 「{月}月{日}日」
 *       ul > li > a → 全文 PDF
 *   h2: 「一般質問」
 *     h3: 「{議員名}」
 *       ul > li > a → 一般質問 PDF
 *   h2: 「委員長報告」または「閉会中の委員会活動報告」
 *     h3: 「{委員会名}」
 *       ul > li > a → 委員会報告 PDF
 */
export function parseMeetingPage(
  html: string,
  meetingPageUrl: string
): {
  pdfLinks: { url: string; h2Label: string; h3Label: string }[];
} {
  const pdfLinks: { url: string; h2Label: string; h3Label: string }[] = [];

  // h2, h3, a タグを順番に解析して状態を追跡する
  const tagPattern =
    /<(h1|h2|h3|a)([^>]*)>([\s\S]*?)<\/\1>/gi;

  let currentH2 = "";
  let currentH3 = "";

  for (const match of html.matchAll(tagPattern)) {
    const tag = match[1]!.toLowerCase();
    const attrs = match[2]!;
    const content = match[3]!.replace(/<[^>]+>/g, "").trim();

    if (tag === "h2") {
      currentH2 = content;
      currentH3 = "";
    } else if (tag === "h3") {
      currentH3 = content;
    } else if (tag === "a") {
      const hrefMatch = attrs.match(/href="([^"]+\.pdf)"/i);
      if (hrefMatch) {
        const url = toAbsoluteUrl(hrefMatch[1]!, meetingPageUrl);
        pdfLinks.push({
          url,
          h2Label: currentH2,
          h3Label: currentH3,
        });
      }
    }
  }

  return { pdfLinks };
}

/**
 * 旧フォーマット: 年度ページから PDF リンクを収集する。
 *
 * HTML 構造:
 *   h3: 「{月}月{定例会|臨時会}」
 *     a → PDF（リンクテキストに開催日を記載）
 */
export function parseLegacyYearPage(
  html: string,
  yearPageUrl: string,
  year: number
): TonoshoMeeting[] {
  const meetings: TonoshoMeeting[] = [];

  // h3 と a タグを順番に解析して状態を追跡する
  const tagPattern = /<(h3|a)([^>]*)>([\s\S]*?)<\/\1>/gi;

  let currentH3 = "";
  let currentMeetingName = "";

  for (const match of html.matchAll(tagPattern)) {
    const tag = match[1]!.toLowerCase();
    const attrs = match[2]!;
    const content = match[3]!.replace(/<[^>]+>/g, "").trim();

    if (tag === "h3") {
      currentH3 = content;
      currentMeetingName = content;
    } else if (tag === "a") {
      const hrefMatch = attrs.match(/href="([^"]+\.pdf)"/i);
      if (!hrefMatch) continue;

      const url = toAbsoluteUrl(hrefMatch[1]!, yearPageUrl);
      const linkText = content;

      const month = extractMonthFromText(currentH3);
      const heldOn = month
        ? buildHeldOn(year, `${month}月`)
        : `${year}-01-01`;

      meetings.push({
        pdfUrl: url,
        title: `${currentMeetingName} ${linkText}`.trim(),
        heldOn,
        meetingName: currentMeetingName,
        year,
      });
    }
  }

  return meetings;
}

/**
 * 新フォーマット（令和3年以降）の会議別ページを解析して TonoshoMeeting[] を返す。
 */
async function fetchNewFormatMeetings(
  year: number,
  reiwaYear: number
): Promise<TonoshoMeeting[]> {
  const kalerYear = year; // カレンダー年 = 令和年 + 2018
  const indexUrl = `${BASE_ORIGIN}/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa${reiwaYear}/index.html`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const meetingLinks = parseReiwaIndexPage(indexHtml, indexUrl);
  const results: TonoshoMeeting[] = [];

  for (const { url: meetingUrl, meetingName } of meetingLinks) {
    const meetingHtml = await fetchPage(meetingUrl);
    if (!meetingHtml) continue;

    const month = extractMonthFromText(meetingName);
    if (!month) continue;

    // 1〜3月は翌年（年度末）
    const calendarYear = month <= 3 ? kalerYear + 1 : kalerYear;
    const baseHeldOn = buildHeldOn(calendarYear, `${month}月`);

    const { pdfLinks } = parseMeetingPage(meetingHtml, meetingUrl);

    for (const { url: pdfUrl, h2Label, h3Label } of pdfLinks) {
      // h2「全文」かつ h3 に日付がある場合は日付を使う
      let heldOn = baseHeldOn;
      if (h2Label === "全文" && h3Label.match(/\d+月\d+日/)) {
        const dayMatch = h3Label.match(/(\d{1,2})月(\d{1,2})日/);
        if (dayMatch) {
          const m = parseInt(dayMatch[1]!, 10);
          const d = parseInt(dayMatch[2]!, 10);
          const y = m <= 3 ? kalerYear + 1 : kalerYear;
          heldOn = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }
      }

      // タイトル生成
      let title = meetingName;
      if (h2Label) title += ` ${h2Label}`;
      if (h3Label) title += ` ${h3Label}`;

      results.push({
        pdfUrl,
        title: title.trim(),
        heldOn,
        meetingName,
        year,
      });
    }
  }

  return results;
}

/**
 * 旧フォーマット（令和2年以前）の年度ページを解析して TonoshoMeeting[] を返す。
 */
async function fetchLegacyFormatMeetings(year: number): Promise<TonoshoMeeting[]> {
  const yearUrl = LEGACY_YEAR_URLS[year];
  if (!yearUrl) return [];

  const html = await fetchPage(yearUrl);
  if (!html) return [];

  return parseLegacyYearPage(html, yearUrl, year);
}

/**
 * 指定年度の全 PDF リンクを取得する。
 *
 * year: カレンダー年（例: 2024 = 令和6年度相当）
 * 土庄町は年度（4月〜翌3月）単位での整理はされていないため、
 * 年（1月〜12月）単位で取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<TonoshoMeeting[]> {
  const reiwaYear = year - 2018;

  if (reiwaYear >= 3) {
    // 新フォーマット: reiwa{N}/index.html
    return fetchNewFormatMeetings(year, reiwaYear);
  } else if (LEGACY_YEAR_URLS[year]) {
    // 旧フォーマット: 数字 ID 形式
    return fetchLegacyFormatMeetings(year);
  }

  return [];
}

/** 会議タイプを meetingName から判定 (shared.detectMeetingType と同等) */
export { detectMeetingType };
