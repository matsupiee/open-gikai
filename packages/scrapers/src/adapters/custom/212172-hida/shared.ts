/**
 * 飛騨市議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.city.hida.gifu.jp/site/gikai/
 * 自治体コード: 212172
 *
 * PDF 形式で会議録を公開。年度ごとの一覧ページから PDF リンクを収集する。
 * 年度ページの URL はルールが統一されていないためハードコードする。
 */

export const BASE_ORIGIN = "https://www.city.hida.gifu.jp";

/**
 * 年度（西暦）→ 一覧ページ URL のマッピング。
 * URL パターンが不規則なためハードコードする。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: `${BASE_ORIGIN}/site/gikai/72604.html`,
  2024: `${BASE_ORIGIN}/site/gikai/62150.html`,
  2023: `${BASE_ORIGIN}/site/gikai/53785.html`,
  2022: `${BASE_ORIGIN}/site/gikai/kaigiroku.html`,
  2021: `${BASE_ORIGIN}/site/gikai/r3kaigiroku.html`,
  2020: `${BASE_ORIGIN}/site/gikai/r2kaigiroku.html`,
  2019: `${BASE_ORIGIN}/site/gikai/r1kaigiroku.html`,
  2018: `${BASE_ORIGIN}/site/gikai/h30kaigiroku.html`,
  2017: `${BASE_ORIGIN}/soshiki/25/3518.html`,
  2016: `${BASE_ORIGIN}/soshiki/25/3523.html`,
  2015: `${BASE_ORIGIN}/soshiki/25/3524.html`,
  2014: `${BASE_ORIGIN}/soshiki/25/3525.html`,
  2013: `${BASE_ORIGIN}/soshiki/25/3526.html`,
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
 * リンクテキストから開催日（YYYY-MM-DD）を抽出する。
 * パターン: 「令和X年X月X日」or 「平成X年X月X日」（全角数字対応）
 */
export function extractDateFromLinkText(text: string): string | null {
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
 * パターン: 「令和X年X月X日」or 「平成X年X月X日」（全角数字対応）
 */
export function extractHeldOnFromText(text: string): string | null {
  return extractDateFromLinkText(text);
}
