/**
 * 清水町議会（北海道） 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.shimizu.hokkaido.jp/gikai/proceeding/
 * 自治体コード: 016365
 *
 * 会議録は HTML で直接公開されている。
 * 新サイト（平成29年以降）と旧サイト（平成17年〜平成28年）でテンプレートが異なる。
 */

export const BASE_ORIGIN = "https://www.town.shimizu.hokkaido.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
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

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成25年" → 2013
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 全角数字を半角数字に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 西暦年から新サイトの年別一覧 URL を組み立てる。
 * 令和元年（2019）= /gikai/proceeding/1/
 * 令和7年（2025） = /gikai/proceeding/7/
 * 平成29年（2017）= /gikai/proceeding/29/
 * 平成30年（2018）= /gikai/proceeding/30/
 */
export function buildNewSiteYearListUrl(eraNum: number): string {
  return `${BASE_ORIGIN}/gikai/proceeding/${eraNum}/`;
}

/**
 * 西暦年から旧サイトの年別一覧 URL を組み立てる。
 * 平成17年（2005）〜平成28年（2016）
 */
export function buildOldSiteYearListUrl(eraNum: number): string {
  return `${BASE_ORIGIN}/gikai/past/kaigiroku/${eraNum}/index.html`;
}

/**
 * 西暦年を令和・平成の年数に変換してサイト種別と共に返す。
 * 令和元年（2019）〜: 新サイト
 * 平成29年（2017）〜平成30年（2018）: 新サイト
 * 平成17年（2005）〜平成28年（2016）: 旧サイト
 */
export function westernYearToEraInfo(
  year: number,
): { eraNum: number; site: "new" | "old" } | null {
  if (year >= 2019) {
    // 令和
    const reiwaYear = year - 2018;
    return { eraNum: reiwaYear, site: "new" };
  }
  if (year >= 2017) {
    // 平成29・30
    const heiseiYear = year - 1988;
    return { eraNum: heiseiYear, site: "new" };
  }
  if (year >= 2005) {
    // 平成17〜28
    const heiseiYear = year - 1988;
    return { eraNum: heiseiYear, site: "old" };
  }
  return null;
}
