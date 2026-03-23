/**
 * 潟上市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.katagami.lg.jp/gyosei/gyoseijoho/shigikai/kaigiroku/index.html
 * 自治体コード: 052116
 *
 * 全会議録は PDF ファイルで提供される。
 * 5つの年代別ページから PDF リンクを収集し、各 PDF をダウンロードして解析する。
 */

export const BASE_ORIGIN = "https://www.city.katagami.lg.jp";

/**
 * 年代別ページの ID と対象期間。
 * 最新の年代から順に並べる。
 */
export const YEAR_PAGE_IDS = [4189, 2769, 2768, 2767, 2766] as const;

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
 * e.g., "令和6年" → 2024, "令和元年" → 2019, "平成31年" → 2019
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
 * リンクテキストから開催日 YYYY-MM-DD を解析する。
 * パターン: "1日目（令和6年9月4日）" / "（平成30年12月4日）"
 * 解析できない場合は null を返す（フォールバック値禁止）。
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

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
