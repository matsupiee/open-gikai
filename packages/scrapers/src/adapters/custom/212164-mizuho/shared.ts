/**
 * 瑞穂市議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.city.mizuho.lg.jp/3412.htm
 * 自治体コード: 212164
 *
 * PDF 形式で会議録を公開。年度ごとの一覧ページから会議ページへ、
 * 会議ページから PDF リンクを収集する構造。
 * 年度ページの URL はルールが統一されていないためハードコードする。
 */

export const BASE_ORIGIN = "https://www.city.mizuho.lg.jp";

/**
 * 年度（西暦）→ 一覧ページ URL のマッピング。
 * URL パターンが不規則なためハードコードする。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: `${BASE_ORIGIN}/13677.htm`,
  2024: `${BASE_ORIGIN}/13295.htm`,
  2023: `${BASE_ORIGIN}/12729.htm`,
  2022: `${BASE_ORIGIN}/12283.htm`,
  2021: `${BASE_ORIGIN}/11705.htm`,
  2020: `${BASE_ORIGIN}/10142.htm`,
  2019: `${BASE_ORIGIN}/9639.htm`,
  2018: `${BASE_ORIGIN}/9537.htm`,
  2017: `${BASE_ORIGIN}/8396.htm`,
  2016: `${BASE_ORIGIN}/5852.htm`,
  2015: `${BASE_ORIGIN}/5103.htm`,
  2014: `${BASE_ORIGIN}/4167.htm`,
  2013: `${BASE_ORIGIN}/3420.htm`,
  2012: `${BASE_ORIGIN}/3418.htm`,
  2011: `${BASE_ORIGIN}/3419.htm`,
  2010: `${BASE_ORIGIN}/1735.htm`,
  2009: `${BASE_ORIGIN}/1734.htm`,
  2008: `${BASE_ORIGIN}/1727.htm`,
  2007: `${BASE_ORIGIN}/1728.htm`,
  2006: `${BASE_ORIGIN}/1729.htm`,
  2005: `${BASE_ORIGIN}/1730.htm`,
  2004: `${BASE_ORIGIN}/1731.htm`,
  2003: `${BASE_ORIGIN}/1732.htm`,
};

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * - 臨時会 → extraordinary
 * - 委員会 / 審査会 → committee
 * - それ以外（本会議・定例会） → plenary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会") || title.includes("審査会"))
    return "committee";
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
 * テキストから開催日（YYYY-MM-DD）を抽出する。
 * パターン: 「令和X年X月X日」or 「平成X年X月X日」（全角数字対応、元年対応）
 */
export function extractDateFromText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const baseYear = era === "令和" ? 2018 : 1988;
  const westernYear = baseYear + eraYear;
  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 */
export function extractHeldOnFromText(text: string): string | null {
  return extractDateFromText(text);
}
