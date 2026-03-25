/**
 * 洞爺湖町議会 — 共通ユーティリティ
 *
 * サイト: http://www.town.toyako.hokkaido.jp/town_administration/town_council/toc006/
 * PDF ベースの議事録公開（年度別一覧ページ → PDF ダウンロード）
 */

export const BASE_URL = "http://www.town.toyako.hokkaido.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[015849-toyako] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[015849-toyako] fetchPage error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`[015849-toyako] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[015849-toyako] fetchBinary error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 全角数字を半角数字に変換する。
 */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 「元年」表記にも対応する。
 * e.g., "令和3" → 2021, "平成30" → 2018, "元" (令和) → 2019
 */
export function eraToWesternYear(era: string, yearStr: string): number | null {
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 和暦テキスト全体（例: "令和3年5月6日"）から YYYY-MM-DD を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  const normalized = normalizeNumbers(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦の年月（例: "令和7年9月"）から年月を返す。
 * 開催日が不明な場合に月初日として推定するため使用。
 */
export function parseJapaneseYearMonth(text: string): { year: number; month: number } | null {
  const normalized = normalizeNumbers(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  return { year, month };
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会") || title.includes("協議会") || title.includes("議会運営")) {
    return "committee";
  }
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 相対パスまたは絶対 URL を絶対 URL に正規化する。
 */
export function normalizeUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  if (href.startsWith("/")) {
    return `${BASE_URL}${href}`;
  }
  return `${BASE_URL}/${href}`;
}
