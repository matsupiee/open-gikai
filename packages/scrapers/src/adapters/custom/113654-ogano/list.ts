/**
 * 小鹿野町議会 — list フェーズ
 *
 * 一覧ページから全会議録ファイル名を収集し、
 * 対象年にマッチするものを返す。
 */

import {
  BASE_URL,
  detectMeetingType,
  fetchPage,
  fileNameToMonth,
  fileNameToSessionType,
  fileNameToYear,
  normalizeNumbers,
} from "./shared";

export interface OganoMeeting {
  /** 本文 main.html の完全 URL */
  mainUrl: string;
  /** フレームセット HTML のファイル名（externalId に利用） */
  fileName: string;
  /** 会議タイトル（例: "令和6年第3回（9月）定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別 */
  sessionType: string;
}

/**
 * 一覧ページ HTML から会議録ファイル名を抽出する（テスト可能な純粋関数）。
 *
 * 一覧ページのリンクパターン:
 *   <a href="R0703T.html">第１回（３月）定例会</a>
 *   <a href="R0611R.html">第４回（11月）臨時会</a>
 *
 * index.html 自身・_index.html（目次フレーム）・main.html は除外する。
 */
export function parseListPage(html: string): string[] {
  const fileNames: string[] = [];
  const seen = new Set<string>();

  // href="[大文字始まり英数字].html" パターンのリンクを抽出
  const linkPattern = /href="([A-Z][A-Z0-9]*\.html)"/gi;

  for (const match of html.matchAll(linkPattern)) {
    const name = match[1]!;
    // _index.html や main.html は本文フレームまたは目次フレームなのでスキップ
    if (name.includes("_index") || name.toLowerCase().includes("main")) continue;
    // index.html 自身もスキップ
    if (name.toLowerCase() === "index.html") continue;

    if (!seen.has(name)) {
      seen.add(name);
      fileNames.push(name);
    }
  }

  return fileNames;
}

/**
 * ファイル名から OganoMeeting オブジェクトを構築する。
 */
export function buildMeeting(fileName: string): OganoMeeting | null {
  const year = fileNameToYear(fileName);
  const month = fileNameToMonth(fileName);
  const sessionType = fileNameToSessionType(fileName);

  if (!year || !month || !sessionType) return null;

  const heldOn = `${year}-${String(month).padStart(2, "0")}-01`;

  // 和暦タイトルを構築
  let eraTitle: string;
  if (year >= 2020) {
    eraTitle = `令和${year - 2018}年`;
  } else if (year === 2019) {
    // 令和元年（R01）または平成31年（H31）
    const match = fileName.match(/^([RH])/i);
    if (match && match[1]!.toUpperCase() === "R") {
      eraTitle = "令和元年";
    } else {
      eraTitle = "平成31年";
    }
  } else {
    const eraYear = year - 1988;
    eraTitle = eraYear === 1 ? "平成元年" : `平成${eraYear}年`;
  }

  const title = `${eraTitle}（${month}月）${sessionType}`;
  const mainUrl = `${BASE_URL}${fileName.replace(/\.html$/i, "")}main.html`;

  return {
    mainUrl,
    fileName,
    title,
    heldOn,
    sessionType: detectMeetingType(sessionType),
  };
}

/**
 * 指定年の会議録リストを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<OganoMeeting[]> {
  // baseUrl は DB に登録された index.html への完全 URL
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const fileNames = parseListPage(normalizeNumbers(html));

  const meetings: OganoMeeting[] = [];
  for (const fileName of fileNames) {
    const fileYear = fileNameToYear(fileName);
    if (fileYear !== year) continue;

    const meeting = buildMeeting(fileName);
    if (meeting) meetings.push(meeting);
  }

  return meetings;
}
