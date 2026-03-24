/**
 * 洞爺湖町議会 — list フェーズ
 *
 * クロール構造:
 *   1. トップページ（令和7年）と年度別ページ（ページID一覧）を順番に取得
 *   2. 各ページ内の <table class="color1"> を全て取得
 *   3. 各テーブルの thead から会議名を抽出
 *   4. 各テーブルの tbody 内の <a> タグから PDF リンクを抽出
 *   5. リンクテキストから開催日を抽出
 */

import {
  BASE_URL,
  detectMeetingType,
  fetchPage,
  normalizeNumbers,
  normalizeUrl,
  parseJapaneseDate,
  parseJapaneseYearMonth,
  eraToWesternYear,
} from "./shared";

export const TOP_URL = `${BASE_URL}/town_administration/town_council/toc006/`;

/**
 * 年度別ページID一覧（古い年度から新しい年度の順）
 * トップページは令和7年（2025年）
 */
export const YEAR_PAGE_IDS: Array<{ pageId: string | null; year: number }> = [
  { pageId: null, year: 2025 },       // トップページ（令和7年）
  { pageId: "3972", year: 2024 },     // 令和6年
  { pageId: "3632", year: 2023 },     // 令和5年
  { pageId: "3175", year: 2022 },     // 令和4年
  { pageId: "2766", year: 2021 },     // 令和3年
  { pageId: "2494", year: 2020 },     // 令和2年
  { pageId: "2065", year: 2019 },     // 平成31年・令和元年
  { pageId: "2064", year: 2018 },     // 平成30年
  { pageId: "2063", year: 2017 },     // 平成29年
  { pageId: "2062", year: 2016 },     // 平成28年
  { pageId: "2061", year: 2015 },     // 平成27年
  { pageId: "2060", year: 2014 },     // 平成26年
];

export interface ToyakoMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "洞爺湖町議会令和７年９月会議"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: string;
}

/**
 * 全角文字の月日テキストから日付を解析する。
 * リンクテキスト「第１日目（９月１０日）」から開催日を抽出。
 *
 * @param linkText リンクテキスト（例: "第１日目（９月１０日）"）
 * @param year 会議の年（西暦）
 */
export function parseDayFromLinkText(linkText: string, year: number): string | null {
  const normalized = normalizeNumbers(linkText);
  // 「（M月D日）」パターン
  const match = normalized.match(/（(\d+)月(\d+)日）/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  if (isNaN(month) || isNaN(day)) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * テーブルのtheadから会議名を抽出する。
 * 「洞爺湖町議会令和７年９月会議」のようなテキストを返す。
 */
export function extractMeetingTitle(theadHtml: string): string {
  // タグを除去してプレーンテキストを取得
  return theadHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

/**
 * 会議名テキストから年を抽出する（西暦）。
 * 例: "洞爺湖町議会令和７年９月会議" → 2025
 */
export function extractYearFromTitle(title: string): number | null {
  const normalized = normalizeNumbers(title);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 1つの <table class="color1"> の HTML から ToyakoMeeting の配列を生成する。
 *
 * @param tableHtml テーブル全体の HTML
 */
export function parseTable(tableHtml: string): ToyakoMeeting[] {
  const results: ToyakoMeeting[] = [];

  // thead から会議名を抽出
  const theadMatch = tableHtml.match(/<thead[\s\S]*?>([\s\S]*?)<\/thead>/i);
  const meetingTitle = theadMatch ? extractMeetingTitle(theadMatch[1]!) : "";

  // 会議年を抽出
  const meetingYear = extractYearFromTitle(meetingTitle);

  // tbody 内の <a href="..."> を全て抽出
  const tbodyMatch = tableHtml.match(/<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return results;

  const tbodyHtml = tbodyMatch[1]!;
  const linkPattern = /href="([^"]+\.pdf[^"]*)">([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]*>[^<]*)*)<\/a>/gi;

  for (const match of tbodyHtml.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawLinkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次等は含める（会議のメタ情報）
    const pdfUrl = normalizeUrl(decodeURIComponent(href).replace(/\s+/g, "%20"));

    // 開催日の解析
    let heldOn: string | null = null;

    // リンクテキストから日付を解析（「第N日目（M月D日）」形式）
    if (meetingYear) {
      heldOn = parseDayFromLinkText(rawLinkText, meetingYear);
    }

    // リンクテキストそのものに日本語日付が含まれる場合
    if (!heldOn) {
      heldOn = parseJapaneseDate(rawLinkText);
    }

    // 月初日として推定（目次等の場合のフォールバック）
    if (!heldOn && meetingTitle) {
      const ym = parseJapaneseYearMonth(normalizeNumbers(meetingTitle));
      if (ym) {
        heldOn = `${ym.year}-${String(ym.month).padStart(2, "0")}-01`;
      }
    }

    const title = meetingTitle || rawLinkText;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

/**
 * 年度ページの HTML から全テーブルを解析して ToyakoMeeting の配列を返す。
 */
export function parseYearPage(html: string): ToyakoMeeting[] {
  const results: ToyakoMeeting[] = [];
  const seenUrls = new Set<string>();

  // <table class="color1"> を全て抽出
  const tablePattern = /<table[^>]+class="color1"[^>]*>([\s\S]*?)<\/table>/gi;

  for (const tableMatch of html.matchAll(tablePattern)) {
    const tableHtml = tableMatch[0]!;
    const meetings = parseTable(tableHtml);

    for (const meeting of meetings) {
      if (!seenUrls.has(meeting.pdfUrl)) {
        seenUrls.add(meeting.pdfUrl);
        results.push(meeting);
      }
    }
  }

  return results;
}

/**
 * 指定年の会議一覧を取得する。
 *
 * 1. 対象年のページ URL を特定
 * 2. ページから PDF リンクを収集
 */
export async function fetchMeetingList(year: number): Promise<ToyakoMeeting[]> {
  const allMeetings: ToyakoMeeting[] = [];

  // 対象年に対応するページを特定
  const targetPage = YEAR_PAGE_IDS.find((p) => p.year === year);

  if (!targetPage) {
    // 年度リスト外の場合は空配列を返す
    return [];
  }

  const url = targetPage.pageId
    ? `${BASE_URL}/town_administration/town_council/toc006/toc101/${targetPage.pageId}/`
    : TOP_URL;

  const html = await fetchPage(url);
  if (!html) return [];

  const meetings = parseYearPage(html);
  allMeetings.push(...meetings);

  return allMeetings;
}
