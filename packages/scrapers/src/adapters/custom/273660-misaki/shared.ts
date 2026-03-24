/**
 * 岬町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.misaki.osaka.jp/soshiki/gikai/chogikai/gijiroku/index.html
 * PDF ベースの議事録公開。年度別一覧ページから PDF をダウンロードする方式。
 */

export const BASE_ORIGIN = "https://www.town.misaki.osaka.jp";

/** 会議録一覧トップページのパス */
export const INDEX_PATH = "/soshiki/gikai/chogikai/gijiroku/index.html";

/**
 * 年度別ページ URL マッピング（西暦年 → ページ ID）
 * 年度ページの URL に含まれるページ ID は CMS の内部 ID のため規則性がない
 */
export const YEAR_PAGE_IDS: Record<number, string> = {
  2025: "5473",
  2024: "4989",
  2023: "4339",
  2022: "3790",
  2021: "3428",
  2020: "2896",
  2019: "2436",
  2018: "2016",
  2017: "436",
  2016: "437",
  2015: "439",
  2014: "440",
  2013: "441",
  2012: "2090",
  2011: "2091",
  2010: "2092",
  2009: "2093",
  2008: "2096",
  2007: "2098",
  2006: "2100",
};

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * section から判定する。
 */
export function detectMeetingType(section: string): string {
  if (section.includes("委員会")) return "committee";
  if (section.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦テキスト（令和・平成）から西暦年・月・日を取得する。
 *
 * 例:
 *   "令和6年12月24日" → { year: 2024, month: 12, day: 24 }
 *   "平成30年3月7日" → { year: 2018, month: 3, day: 7 }
 *   "令和元年5月1日" → { year: 2019, month: 5, day: 1 }
 */
export function parseJapaneseDate(text: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const month = Number(match[3]);
  const day = Number(match[4]);

  const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);
  let year: number;
  if (era === "令和") {
    year = 2018 + eraYear;
  } else {
    // 平成
    year = 1988 + eraYear;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}
