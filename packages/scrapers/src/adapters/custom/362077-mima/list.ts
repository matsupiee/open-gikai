/**
 * 美馬市議会（徳島県） — list フェーズ
 *
 * 一覧トップページ（2ページ）から年度別ページ URL を収集し、
 * 各年度ページから PDF リンクとメタ情報を収集する。
 *
 * 一覧トップページ構造:
 *   <a href="/gyosei/docs/{ID}.html">令和7年市議会会議録</a>
 *
 * 年度別ページ構造（/gyosei/docs/{ID}.html）:
 *   <h2>令和7年3月定例会</h2>
 *   <a href="/fs/.../ファイル名.pdf">令和7年3月美馬市議会定例会(第1号)(開催日2025年2月18日)</a>
 */

import { BASE_ORIGIN, LIST_PAGE_URLS, fetchPage, eraToWesternYear, delay } from "./shared";

export interface MimaMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年3月美馬市議会定例会(第1号)"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 一覧ページ HTML から年度別ページへのリンクを抽出する。
 * href が /gyosei/docs/{ID}.html 形式のリンクを抽出する。
 */
export function parseYearPageLinks(html: string): string[] {
  const urls: string[] = [];
  const linkPattern = /<a[^>]+href="(\/gyosei\/docs\/\d+\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const path = match[1]!;
    const fullUrl = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * リンクテキストのパターン:
 *   定例会: "令和7年3月美馬市議会定例会(第1号)(開催日2025年2月18日)"
 *   臨時会: "令和7年第1回美馬市議会臨時会(開催日2025年5月16日)"
 */
export function parseYearPage(html: string): MimaMeeting[] {
  const results: MimaMeeting[] = [];

  // PDF リンクパターン: href が /fs/ で始まり .pdf で終わるリンク
  const linkPattern =
    /<a[^>]+href="(\/fs\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();

    if (!rawText) continue;

    const pdfUrl = `${BASE_ORIGIN}${href}`;
    const heldOn = parseLinkTextDate(rawText);
    const title = parseLinkTextTitle(rawText);

    results.push({
      pdfUrl,
      title: title ?? rawText,
      heldOn,
    });
  }

  return results;
}

/**
 * リンクテキストから開催日 YYYY-MM-DD を解析する。
 *
 * パターン:
 *   "...（開催日2025年2月18日）" / "...(開催日2025年2月18日)"
 */
export function parseLinkTextDate(text: string): string | null {
  const match = text.match(/[（(]開催日(\d{4})年(\d{1,2})月(\d{1,2})日[）)]/);
  if (!match) return null;

  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストから会議タイトルを抽出する。
 * 開催日部分（「(開催日...)」）を除いた部分を返す。
 */
export function parseLinkTextTitle(text: string): string | null {
  // 開催日パターンを除去
  const withoutDate = text.replace(/[（(]開催日\d{4}年\d{1,2}月\d{1,2}日[）)]/, "").trim();
  if (!withoutDate) return null;
  return withoutDate;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 一覧トップページ（2ページ）から年度別ページ URL を収集し、各ページを巡回する。
 */
export async function fetchMeetingList(year: number): Promise<MimaMeeting[]> {
  // 年度別ページ URL を全量収集（2ページ分）
  const yearPageUrls: string[] = [];
  for (const listUrl of LIST_PAGE_URLS) {
    const html = await fetchPage(listUrl);
    if (!html) continue;
    const links = parseYearPageLinks(html);
    for (const url of links) {
      if (!yearPageUrls.includes(url)) {
        yearPageUrls.push(url);
      }
    }
    await delay(INTER_PAGE_DELAY_MS);
  }

  const allMeetings: MimaMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html);

    // 対象年でフィルタ（heldOn が解析できた場合のみ年でフィルタ、できない場合も含める）
    for (const meeting of meetings) {
      if (meeting.heldOn) {
        const meetingYear = parseInt(meeting.heldOn.slice(0, 4), 10);
        if (meetingYear === year) {
          allMeetings.push(meeting);
        }
      } else {
        // 開催日が不明な場合は、リンクテキストから年度を推測して含める
        const westernYear = eraToWesternYear(meeting.title);
        if (westernYear === year) {
          allMeetings.push(meeting);
        }
      }
    }

    await delay(INTER_PAGE_DELAY_MS);
  }

  return allMeetings;
}
