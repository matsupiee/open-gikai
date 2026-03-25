/**
 * 田子町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.takko.lg.jp/index.cfm/13,0,45,190,html
 * ColdFusion CMS ベースのサイトで、年度別ページに定例会・臨時会の PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.takko.lg.jp";

/** 議事録一覧ページの固定 URL */
export const LIST_URL =
  "https://www.town.takko.lg.jp/index.cfm/13,0,45,190,html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "平成元年" → 1989, "平成7年" → 1995
 */
export function parseEraYear(text: string): number | null {
  const match = text.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
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
