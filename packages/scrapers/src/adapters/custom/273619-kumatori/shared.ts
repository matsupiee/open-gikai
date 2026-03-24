/**
 * 熊取町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/index.html
 * PDF ベースの議事録公開。年度別一覧ページから PDF をダウンロードする方式。
 */

export const BASE_ORIGIN = "https://www.town.kumatori.lg.jp";

/** 会議録一覧トップページのパス */
export const INDEX_PATH =
  "/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/index.html";

/**
 * 年度別ページ URL マッピング（西暦年 → ページ ID）
 * 年度ページの URL に含まれるページ ID は CMS の内部 ID のため規則性がない
 */
export const YEAR_PAGE_IDS: Record<number, string> = {
  2025: "14305",
  2024: "12952",
  2023: "11535",
  2022: "8509",
  2021: "1945",
  2020: "1944",
  2019: "1943",
  2018: "1910",
  2017: "1909",
  2016: "1908",
};

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * title または section から判定する。
 */
export function detectMeetingType(section: string): string {
  if (section.includes("委員会") || section.includes("全員協議会"))
    return "committee";
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
 * 西暦年を和暦テキストに変換する。
 * e.g., 2025 → ["令和7年"], 2019 → ["令和元年", "平成31年"]
 */
export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    results.push(`令和${year - 2018}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
  }

  return results;
}
