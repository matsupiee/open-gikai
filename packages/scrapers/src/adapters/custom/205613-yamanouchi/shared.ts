/**
 * 山ノ内町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.yamanouchi.nagano.jp/soshiki/gikai_jimukyoku/gyomu/gikai/520.html
 * 自治体コード: 205613
 */

export const BASE_ORIGIN = "https://www.town.yamanouchi.nagano.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * - 臨時会 → extraordinary
 * - 委員会 → committee
 * - 定例会 → plenary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
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
 * 全角数字を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦年号と年数から西暦年を返す。
 * 「元」年に対応（令和元年=2019年, 平成元年=1989年）
 */
export function eraToWesternYear(era: string, eraYearStr: string): number {
  const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);
  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  return NaN;
}

/**
 * h3 タグの定例会・臨時会名から西暦年を返す。
 * 「令和7年第6回定例会（12月）」→ 2025
 */
export function parseSessionYear(sessionName: string): number | null {
  const normalized = toHalfWidth(sessionName);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  const year = eraToWesternYear(match[1]!, match[2]!);
  return isNaN(year) ? null : year;
}

/**
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 * パターン: 「令和X年X月X日」（全角数字対応）
 */
export function extractHeldOnFromText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const westernYear = eraToWesternYear(era, eraYearStr);
  if (isNaN(westernYear)) return null;

  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * プロトコル相対 URL を絶対 URL に変換する。
 * "//www.town.yamanouchi.nagano.jp/..." → "https://www.town.yamanouchi.nagano.jp/..."
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return href;
}
