/**
 * 新地町議会 会議録 — 共通ユーティリティ
 *
 * サイト: http://shinchi-k.k-quick.net/index.html
 * 分類: k-quick.net ドメインの静的 HTML + PDF 公開型
 * 文字コード: Shift_JIS（HTML ページ）
 */

export const BASE_URL = "http://shinchi-k.k-quick.net";

/** 年度コードの一覧（新しい順） */
export const YEAR_CODES = [
  "R0700",
  "R0600",
  "R0500",
  "R0400",
  "R0300",
  "R0200",
  "R0100",
  "H3100",
  "H3000",
  "H2900",
  "H2800",
  "H2700",
] as const;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 年度コードから西暦年を計算する */
export function yearCodeToWesternYear(code: string): number {
  const era = code[0]; // "R" or "H"
  const eraYear = parseInt(code.slice(1, 3), 10);
  if (era === "R") {
    return eraYear + 2018; // 令和元年 = 2019
  } else {
    return eraYear + 1988; // 平成元年 = 1989
  }
}

/** 西暦年から年度コードを生成する（令和・平成対応） */
export function westernYearToYearCode(year: number): string | null {
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return `R${String(reiwaYear).padStart(2, "0")}00`;
  } else if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `H${String(heiseiYear).padStart(2, "0")}00`;
  }
  return null;
}

/** 年度別一覧ページの URL を生成する */
export function buildYearPageUrl(yearCode: string): string {
  return `${BASE_URL}/${yearCode}.html`;
}

/** PDF の URL を生成する */
export function buildPdfUrl(yearCode: string, fileName: string): string {
  return `${BASE_URL}/pdf/${yearCode}/${fileName}`;
}

/** 会議タイプを検出する */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す（Shift_JIS のページも対応） */
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
    // Shift_JIS の HTML を正しくデコードする
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buffer);
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF 用） */
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

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * 全角数字・半角数字の両方に対応する。
 * 令和元年にも対応。
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const westernYear = eraYear + (era === "平成" ? 1988 : 2018);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * タイトルから年を抽出する（西暦）。
 * 令和元年にも対応。
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  return eraYear + (era === "平成" ? 1988 : 2018);
}
