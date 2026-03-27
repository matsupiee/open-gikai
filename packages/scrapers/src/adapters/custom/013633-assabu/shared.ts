/**
 * 厚沢部町議会（北海道） — 共通ユーティリティ
 *
 * サイト: https://www.town.assabu.lg.jp/site/gikai/list32.html
 * 自治体コード: 013633
 */

export const BASE_ORIGIN = "https://www.town.assabu.lg.jp";

/** 議事録一覧ページ URL */
export const LIST_URL = `${BASE_ORIGIN}/site/gikai/list32.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 和暦テキストを西暦年に変換する。
 * 例: "令和6年" → 2024, "令和元年" → 2019, "平成31年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const year = reiwa[1] === "元" ? 1 : Number(reiwa[1]);
    return 2018 + year;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const year = heisei[1] === "元" ? 1 : Number(heisei[1]);
    return 1988 + year;
  }

  return null;
}

export function buildDateString(
  year: number,
  monthDayText: string,
): string | null {
  const match = toHalfWidth(monthDayText).match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[013633-assabu] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[013633-assabu] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `[013633-assabu] fetchBinary failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[013633-assabu] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
