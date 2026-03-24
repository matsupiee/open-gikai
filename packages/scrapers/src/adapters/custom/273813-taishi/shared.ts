/**
 * 太子町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.taishi.osaka.jp/busyo/gikai_jimu/taishichougikai/kaigirokunoetsuran/index.html
 * PDF ベースの議事録公開。年度別一覧ページから PDF をダウンロードする方式。
 */

export const BASE_ORIGIN = "https://www.town.taishi.osaka.jp";

/**
 * 年度別ページ URL マッピング（西暦年 → ページ ID）
 * 年度ページの URL に含まれるページ ID は CMS の内部 ID のため規則性がない
 */
export const YEAR_PAGE_IDS: Record<number, string> = {
  2025: "6137",
  2024: "5733",
  2023: "5090",
  2022: "4391",
  2021: "4097",
  2020: "3968",
  2019: "3964",
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
