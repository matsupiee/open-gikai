/**
 * 築上町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.chikujo.fukuoka.jp/li/020/070/040/index.html
 * 自治体公式サイトで、トップページ → 年度ページ → 会議ページ → PDF の階層で公開される。
 */

export const BASE_ORIGIN = "https://www.town.chikujo.fukuoka.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員")) return "committee";
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** 相対 URL を絶対 URL に変換する */
export function toAbsoluteUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;

  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/** 全角数字を半角数字に変換する */
function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 「令和7年」→ 2025
 * 「平成31年（令和元年）」→ 2019
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const year = reiwa[1] === "元" ? 1 : Number.parseInt(reiwa[1], 10);
    return year + 2018;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const year = heisei[1] === "元" ? 1 : Number.parseInt(heisei[1], 10);
    return year + 1988;
  }

  return null;
}

/**
 * 和暦日付を YYYY-MM-DD に変換する。
 * 「令和6年12月9日」→ "2024-12-09"
 */
export function parseDateText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearText, monthText, dayText] = match;
  const eraYear = eraYearText === "元" ? 1 : Number.parseInt(eraYearText!, 10);
  const month = Number.parseInt(monthText!, 10);
  const day = Number.parseInt(dayText!, 10);

  const westernYear = era === "令和" ? eraYear + 2018 : eraYear + 1988;
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
