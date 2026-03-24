/**
 * 江北町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.kouhoku.saga.jp/list00321.html
 * 自治体コード: 414247
 */

export const BASE_ORIGIN = "https://www.town.kouhoku.saga.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別一覧ページの URL マッピング。
 * 年度 URL は連番ではなく飛び番のため、ハードコードする。
 * 令和2年以降は list[番号].html 形式、平成25〜30年は kiji[番号]/index.html 形式。
 */
export const YEAR_LIST_URLS: Record<number, string> = {
  2026: `${BASE_ORIGIN}/list00769.html`, // 令和8年
  2025: `${BASE_ORIGIN}/list00740.html`, // 令和7年
  2024: `${BASE_ORIGIN}/list00717.html`, // 令和6年
  2023: `${BASE_ORIGIN}/list00699.html`, // 令和5年
  2022: `${BASE_ORIGIN}/list00682.html`, // 令和4年
  2021: `${BASE_ORIGIN}/list00643.html`, // 令和3年
  2020: `${BASE_ORIGIN}/list00611.html`, // 令和2年
  2019: `${BASE_ORIGIN}/list00540.html`, // 平成31年/令和元年
  2018: `${BASE_ORIGIN}/kiji003696/index.html`, // 平成30年
  2017: `${BASE_ORIGIN}/kiji003695/index.html`, // 平成29年
  2016: `${BASE_ORIGIN}/kiji003694/index.html`, // 平成28年
  2015: `${BASE_ORIGIN}/kiji003693/index.html`, // 平成27年
  2014: `${BASE_ORIGIN}/kiji003692/index.html`, // 平成26年
  2013: `${BASE_ORIGIN}/kiji003691/index.html`, // 平成25年
};

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を抽出する。
 * 例: "令和6年1月 定例会" → 2024, "平成30年12月 定例会" → 2018
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** バイナリデータを fetch して返す（PDF ダウンロード用） */
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
