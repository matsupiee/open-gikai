/**
 * 越知町議会 — list フェーズ
 *
 * 議事録閲覧ページから PDF リンクとメタ情報を抽出する。
 *
 * ページ構造:
 * - `https://www.town.ochi.kochi.jp/gikai/gijiroku` に全 PDF が一覧表示される
 * - `/storage/files/gikai/gijiroku*.pdf` パターンの PDF リンクを Cheerio 相当の regex で抽出
 * - リンクテキストに会議名・日付が含まれる場合がある
 *
 * ファイル名の揺れが激しいため、一覧ページからのリンク抽出が必須。
 */

import { BASE_ORIGIN, LIST_URL, eraToWesternYear, fetchPage, normalizeDigits } from "./shared";

export interface OchiMeeting {
  pdfUrl: string;
  /** リンクテキスト（会議名など） */
  linkText: string;
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 抽出条件:
 * - href が /storage/files/gikai/ を含み .pdf で終わるリンク
 */
export function parseListPage(html: string): OchiMeeting[] {
  const results: OchiMeeting[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]*\/storage\/files\/gikai\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkHtml = match[2]!;
    const linkText = linkHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[\s　]+/g, " ")
      .trim();

    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    results.push({ pdfUrl, linkText });
  }

  return results;
}

/**
 * PDF テキストの冒頭から開催日（YYYY-MM-DD）を抽出する。
 *
 * 越知町の PDF 冒頭パターン:
 *   令和７年３月１２日　越知町議会（定例会）を越知町役場議場に招集された。
 *   開議第３日
 *
 * 全角数字にも対応する。
 * 解析できない場合は null を返す（"1970-01-01" は絶対に返さない）。
 */
export function parseMeetingDateFromText(text: string): string | null {
  // 全角数字を半角に変換してから検索する
  const normalized = normalizeDigits(text.replace(/[\s　]+/g, " ")).trim();

  const eraMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const [, era, eraYearStr, monthStr, dayStr] = eraMatch;
    const westernYear = eraToWesternYear(era!, eraYearStr!);
    if (!westernYear) return null;
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * PDF テキストの冒頭から会議タイトルを抽出する。
 *
 * 越知町の PDF 冒頭パターン:
 *   令和７年第２回越知町議会定例会　会議録
 *
 * 解析できない場合は null を返す。
 */
export function parseMeetingTitleFromText(text: string): string | null {
  const normalized = normalizeDigits(text.replace(/[\s　]+/g, " ")).substring(0, 300);

  const titleMatch = normalized.match(
    /(令和|平成)(元|\d+)年第(\d+)回越知町議会(定例会|臨時会)/
  );
  if (titleMatch) {
    const sessionNum = titleMatch[3]!;
    const type = titleMatch[4]!;
    return `第${sessionNum}回 ${type}`;
  }

  return null;
}

/**
 * PDF テキストの冒頭から開議日数（第N日）を抽出する。
 *
 * 越知町の PDF パターン:
 *   開議第３日
 *
 * 解析できない場合は null を返す。
 */
export function parseMeetingDayFromText(text: string): number | null {
  const normalized = normalizeDigits(text.replace(/[\s　]+/g, " ")).substring(0, 500);

  // 「開議第N日」または「開会第N日」
  const dayMatch = normalized.match(/開[議会]第(\d+)日/);
  if (dayMatch) {
    return parseInt(dayMatch[1]!, 10);
  }

  return null;
}

/**
 * PDF の発行年（西暦）を URL ファイル名から推定する（補助的用途）。
 *
 * ファイル名パターン: gijiroku{和暦年}.*.pdf
 * e.g., gijiroku7.3-1.pdf → 令和7年 → 2025
 *
 * 不明な場合は null を返す。
 */
export function parseYearFromPdfUrl(pdfUrl: string): number | null {
  // gijiroku または gojiroku（誤字対応）
  const match = pdfUrl.match(/g[io]jiroku(\d+)\./);
  if (!match) return null;

  const num = parseInt(match[1]!, 10);
  // 平成か令和かは年数で判定: 23以上は平成、それ以下は令和（令和は2019〜）
  // 平成23〜31年: num=23〜31 → 1988+num
  // 令和1〜: num=1〜 → 2018+num
  // 平成31(2019) と令和1(2019) は同じ年。
  // 平成は23〜31まで存在するため、23以上は平成と判定する。
  if (num >= 23) {
    return 1988 + num; // 平成
  } else {
    return 2018 + num; // 令和
  }
}

/**
 * 指定年の全 PDF リンクを取得する。
 *
 * 一覧ページには全年分が掲載されているが、
 * PDF テキスト内の年情報で絞り込む必要があるため、ここでは全件返す。
 * year は detail フェーズでのフィルタリング用にパラメータとして渡す。
 */
export async function fetchMeetingList(year: number): Promise<OchiMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);

  // URL から推定できる場合は year でフィルタリング（近似）
  return allMeetings.filter((m) => {
    const estimatedYear = parseYearFromPdfUrl(m.pdfUrl);
    if (estimatedYear === null) return true; // 不明な場合は含める
    return estimatedYear === year;
  });
}
