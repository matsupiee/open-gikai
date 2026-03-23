/**
 * 橋本市議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. 年度フォルダの index.html から会議ページ URL を取得
 * 2. 各会議ページから PDF リンクを抽出
 *
 * 構造:
 *   年度ページ: <li><a href=".../{id}.html">令和7年3月定例会会議録</a></li>
 *   会議ページ: <h2>第1日(2月25日)</h2> + <a href="//.../{name}.pdf">令和7年2月25日 会議録 (PDFファイル: ...)</a>
 */

import {
  BASE_ORIGIN,
  BASE_PATH,
  buildYearPageUrl,
  detectMeetingType,
  fetchPage,
  getYearFolder,
} from "./shared";

export interface HashimotoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingType: string;
}

/**
 * 年度一覧ページから各会議ページへのリンクを抽出する。
 * 各リンクのテキスト（例: "令和7年3月定例会会議録"）と URL を返す。
 */
export function parseYearIndexPage(
  html: string,
  pageUrl: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // <a> タグからリンクを抽出
  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]*(?:定例会|臨時会)[^<]*)<\/a>/gi;

  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    // 会議録ページのみ対象（定例会 or 臨時会を含むリンク）
    if (!label.includes("会議録")) continue;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = baseUrl + href;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * 例: "令和7年2月25日" → "2025-02-25"
 *     "平成31年3月5日" → "2019-03-05"
 *     "令和元年6月10日" → "2019-06-10"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
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
 * 会議詳細ページの HTML から PDF リンクとメタ情報を抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 *   <h1>令和7年3月定例会会議録</h1>
 *   <h2>第1日(2月25日)</h2>
 *   <a href="//www.city.hashimoto.lg.jp/material/files/group/27/2025-0225.pdf">
 *     令和7年2月25日　会議録 (PDFファイル: 274.8KB)
 *   </a>
 *
 * 目次 PDF はスキップする。
 */
export function parseMeetingPage(
  html: string,
  sessionTitle: string
): HashimotoMeeting[] {
  const results: HashimotoMeeting[] = [];

  // PDF リンクを抽出
  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次 PDF はスキップ
    if (linkText.includes("目次")) continue;

    // リンクテキストから日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    // PDF URL を構築（protocol-relative URL に対応）
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // タイトル構築: セッション名 + 日付
    const cleanLinkText = linkText
      .replace(/\(PDFファイル[^)]*\)/g, "")
      .replace(/（PDFファイル[^）]*）/g, "")
      .trim();
    const title = `${sessionTitle} ${cleanLinkText}`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(sessionTitle),
    });
  }

  return results;
}

/**
 * バックナンバーページから会議ページへのリンクを抽出する。
 */
export function parseBackNumberPage(
  html: string
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*back_number\/[^"]*\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    if (!label.includes("定例会") && !label.includes("臨時会")) continue;

    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}${BASE_PATH}/back_number/${href}`;
    }

    results.push({ label, url });
  }

  return results;
}

/**
 * 西暦年をもとに、対象年度の会議録 PDF 一覧を返す。
 *
 * フロー:
 * 1. 年度フォルダの index.html から会議ページリンクを取得
 * 2. 各会議ページから PDF リンクを抽出
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<HashimotoMeeting[]> {
  const folder = getYearFolder(year);
  if (!folder) {
    console.warn(`[302031-hashimoto] No folder mapping for year=${year}`);
    return [];
  }

  const yearPageUrl = buildYearPageUrl(folder);
  const yearHtml = await fetchPage(yearPageUrl);
  if (!yearHtml) return [];

  const meetingPages = parseYearIndexPage(yearHtml, yearPageUrl);
  if (meetingPages.length === 0) return [];

  const allMeetings: HashimotoMeeting[] = [];

  for (let i = 0; i < meetingPages.length; i++) {
    const page = meetingPages[i]!;
    const meetingHtml = await fetchPage(page.url);
    if (!meetingHtml) continue;

    const meetings = parseMeetingPage(meetingHtml, page.label);
    allMeetings.push(...meetings);

    // レート制限: 最後のリクエスト以外は待機
    if (i < meetingPages.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return allMeetings;
}
