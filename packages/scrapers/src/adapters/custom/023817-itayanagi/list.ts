/**
 * 板柳町議会 — list フェーズ
 *
 * 一覧ページから年度別ページの URL を収集し、
 * 各ページから定例会・臨時会の情報を抽出する。
 */

import { BASE_URL, fetchPage, getIndexUrl, parseIndexPage, parseJapaneseDate } from "./shared";

export interface ItayanagiMeeting {
  /** 会議名（h2テキスト） */
  title: string;
  /** 開催日 YYYY-MM-DD（日付範囲の場合は初日） */
  heldOn: string;
  /** 年度別ページの URL */
  pageUrl: string;
  /** ページ内のセクションインデックス（0始まり） */
  sectionIndex: number;
}

/**
 * 会議タイトルから開催日（初日）を抽出する。
 * 例: 「第4回定例会（令和６年12月２日～６日）」→ "2024-12-02"
 * 例: 「第1回臨時会（令和６年３月11日）」→ "2024-03-11"
 */
export function extractHeldOnFromTitle(title: string): string | null {
  // 括弧内を取得（全角・半角括弧両対応）
  const bracketMatch = title.match(/[（(](.+?)[）)]/);
  if (!bracketMatch?.[1]) return null;

  const inner = bracketMatch[1];

  // 日付範囲の場合は最初の日付を使う（「令和X年X月X日～X日」）
  // まず完全な日付パターンを試みる
  const dateResult = parseJapaneseDate(inner);
  if (dateResult) return dateResult;

  return null;
}

/** HTML タグを除去してプレーンテキストに変換 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 年度別本会議ページから会議一覧を抽出する。
 * h2 見出しごとに1会議として処理する（最初の h2 は年度タイトルのためスキップ）。
 */
export function parseYearPage(html: string, pageUrl: string): ItayanagiMeeting[] {
  const meetings: ItayanagiMeeting[] = [];

  // h2 で分割
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches = Array.from(html.matchAll(h2Regex));

  // 最初の h2 は年度タイトル（「定例会・臨時会　令和X年」等）なのでスキップ
  for (let i = 1; i < h2Matches.length; i++) {
    const match = h2Matches[i];
    if (!match?.[1]) continue;

    const titleText = stripHtml(match[1]);
    if (!titleText) continue;

    // 「第X回定例会」または「第X回臨時会」を含むもののみ対象
    if (!titleText.includes("定例会") && !titleText.includes("臨時会")) continue;

    const heldOn = extractHeldOnFromTitle(titleText);
    if (!heldOn) continue;

    meetings.push({
      title: titleText,
      heldOn,
      pageUrl,
      sectionIndex: i - 1, // 年度タイトルを除いた0始まりインデックス
    });
  }

  return meetings;
}

/**
 * 指定年に対応する年度別ページのファイル名リストを返す。
 * 板柳町は3月起算（令和X年 = 前年3月〜当年2月）なので、
 * 指定年をカバーする年度を複数返す場合がある。
 */
export function getYearPageFilenames(year: number): string[] {
  const filenameSet = new Set<string>();

  // 西暦年から令和・平成ファイル名を生成
  // 板柳町は3月起算のため、指定年をカバーするには当年と前年の両方を確認
  const yearsToCheck = new Set([year, year - 1]);

  for (const y of yearsToCheck) {
    // 令和: 2019年以降（2019年は令和元年 = R1、平成31年との重複あり）
    if (y >= 2019) {
      const reiwa = y - 2018;
      if (reiwa === 2) {
        // 令和2年のみ例外ファイル名
        filenameSet.add("2020-0312-1647-18.html");
      } else if (reiwa >= 1) {
        filenameSet.add(`honkaigi_R${reiwa}.html`);
      }
    }
    // 平成: 2010〜2019年（2019年は平成31年としても存在）
    if (y >= 2010 && y <= 2019) {
      const heisei = y - 1988;
      if (heisei >= 22) {
        filenameSet.add(`honkaigi_H${heisei}.html`);
      }
    }
  }

  return Array.from(filenameSet);
}

/**
 * 指定年の全会議一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<ItayanagiMeeting[]> {
  // 一覧ページから全年度ファイル名を収集
  const indexHtml = await fetchPage(getIndexUrl());
  if (!indexHtml) {
    console.warn("[itayanagi] index page fetch failed");
    return [];
  }

  const allFilenames = parseIndexPage(indexHtml);
  const targetFilenames = getYearPageFilenames(year);

  // 実際に存在するファイル名のみを処理
  const filenames = targetFilenames.filter((f) => allFilenames.includes(f));

  const allMeetings: ItayanagiMeeting[] = [];

  for (const filename of filenames) {
    const pageUrl = `${BASE_URL}${filename}`;
    const html = await fetchPage(pageUrl);
    if (!html) {
      console.warn(`[itayanagi] year page fetch failed: ${pageUrl}`);
      continue;
    }

    const meetings = parseYearPage(html, pageUrl);

    // 指定年に開催された会議のみをフィルタ（YYYY-MM-DD の年部分が year に一致）
    for (const meeting of meetings) {
      const meetingYear = parseInt(meeting.heldOn.slice(0, 4), 10);
      if (meetingYear === year) {
        allMeetings.push(meeting);
      }
    }
  }

  // 日付順にソート
  allMeetings.sort((a, b) => a.heldOn.localeCompare(b.heldOn));

  // 重複除去（同じtitle+heldOn）
  const seen = new Set<string>();
  return allMeetings.filter((m) => {
    const key = `${m.title}__${m.heldOn}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
