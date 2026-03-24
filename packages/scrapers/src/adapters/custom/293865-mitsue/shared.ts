/**
 * 御杖村議会 -- 共通ユーティリティ
 *
 * サイト: https://www.vill.mitsue.nara.jp/
 * 一覧ページ: https://www.vill.mitsue.nara.jp/kurashi/annai/gikaijimukyoku/1/1/336.html
 * PDF ベースの議事録公開。単一ページに全会議録の PDF リンクが時系列で掲載。
 */

export const BASE_ORIGIN = "https://www.vill.mitsue.nara.jp";

/** 会議録一覧ページのパス */
export const LIST_PATH =
  "/kurashi/annai/gikaijimukyoku/1/1/336.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * 定例会 → plenary, 臨時会 → extraordinary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
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

/**
 * 全角数字を半角数字に変換する。
 * e.g., "６" → "6"
 */
export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 「元」にも対応: "令和元年" → 2019, "平成元年" → 1989
 * 全角数字にも対応: "令和６年" → 2024
 */
export function eraToWesternYear(eraText: string): number | null {
  const normalized = normalizeDigits(eraText);
  const match = normalized.match(/(令和|平成|昭和)\s*(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return null;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * 「元」にも対応: "令和元年6月5日" → "2019-06-05"
 * 全角数字にも対応: "令和６年１２月２日" → "2024-12-02"
 * 日付の間に空白が入る場合にも対応: "令和６年１２月 ２日"
 */
export function parseDateText(text: string): string | null {
  const normalized = normalizeDigits(text);
  // 日付の間に空白が入ることがある（例: "令和 ６年 ５月１３日"）ため、\s*を許容
  const match = normalized.match(/(令和|平成|昭和)\s*(元|\d+)年\s*(\d+)月\s*(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else if (era === "昭和") westernYear = eraYear + 1925;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
