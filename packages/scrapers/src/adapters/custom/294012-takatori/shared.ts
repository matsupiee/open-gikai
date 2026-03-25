/**
 * 高取町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.takatori.nara.jp/
 * 一覧ページ: https://www.town.takatori.nara.jp/category_list.php?frmCd=1-1-5-0-0
 * 独自 PHP システムで会議録を管理。全年度分が1ページに掲載。
 */

export const BASE_ORIGIN = "https://www.town.takatori.nara.jp";

/** 会議録一覧ページ URL */
export const LIST_URL = `${BASE_ORIGIN}/category_list.php?frmCd=1-1-5-0-0`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * 定例会 → plenary, 臨時会 → extraordinary, 特別委員会 → special
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("特別委員会") || title.includes("委員会")) return "special";
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
      e instanceof Error ? e.message : e,
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
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * frmCd の年度コードから西暦年を返す。
 * 年度コードは 令和3年=1, 令和4年=2, 令和5年=3, ... と増加する。
 * 西暦年 = 2020 + 年度コード
 * 例: "1-1-5-5-0" → 年度コード5 → 令和7年 → 2025
 *     "1-1-5-3-0" → 年度コード3 → 令和5年 → 2023
 *     "1-1-5-1-0" → 年度コード1 → 令和3年 → 2021
 */
export function frmCdToYear(frmCd: string): number | null {
  const match = frmCd.match(/1-1-5-(\d+)-0/);
  if (!match) return null;
  const yearCode = parseInt(match[1]!, 10);
  if (yearCode === 0) return null;
  return 2020 + yearCode;
}

/**
 * 和暦テキストから西暦年を返す。
 * 「元」にも対応: "令和元年" → 2019
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
 * 全角数字にも対応: "令和６年１２月２日" → "2024-12-02"
 */
export function parseDateText(text: string): string | null {
  const normalized = normalizeDigits(text);
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
