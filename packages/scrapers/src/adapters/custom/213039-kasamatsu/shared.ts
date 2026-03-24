/**
 * 笠松町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.kasamatsu.gifu.jp/category/bunya/chouno_jouhou/gikai/gikaikaigiroku/
 * 自治体コード: 213039
 *
 * 全会議録は PDF ファイルで提供される。
 * 会議録トップページから年度別ページを取得し、各年度ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.kasamatsu.gifu.jp";
export const TOP_PAGE_URL = `${BASE_ORIGIN}/category/bunya/chouno_jouhou/gikai/gikaikaigiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成31年" → 2019
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
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * リンクテキストから開催日 YYYY-MM-DD を解析する。
 * パターン: "令和5年12月5日" / "平成30年3月20日"
 * 解析できない場合は null を返す。
 */
export function parseDateFromLinkText(text: string): string | null {
  const fullMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!fullMatch) return null;

  const year = eraToWesternYear(`${fullMatch[1]}${fullMatch[2]}年`);
  if (!year) return null;

  const month = parseInt(fullMatch[3]!, 10);
  const day = parseInt(fullMatch[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
