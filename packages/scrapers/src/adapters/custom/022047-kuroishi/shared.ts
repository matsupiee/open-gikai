/**
 * 黒石市議会 — 共通ユーティリティ
 *
 * サイト: http://www.city.kuroishi.aomori.jp/shisei/gikai/gikai_kaigiroku.html
 * 自治体コード: 022047
 */

export const BASE_ORIGIN = "http://www.city.kuroishi.aomori.jp";
export const LIST_PATH = "/shisei/gikai/gikai_kaigiroku.html";

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
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[022047-kuroishi] fetchPage failed: ${url}`, e);
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
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[022047-kuroishi] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * ファイル名が補助資料（目次・日程・通告表・議案）かどうかを判定する。
 * 補助資料は本文 PDF ではないためスキップする。
 */
export function isAuxiliaryFile(filename: string): boolean {
  // Schedule_*.pdf, Tuukoku_*.pdf, Shingigian_*.pdf などのプレフィックス
  if (/^(Schedule|Tuukoku|Shingigian)_/i.test(filename)) return true;
  // *_contents.pdf, *_C.pdf (目次), *_S.pdf (日程), *_T.pdf (通告表), *_G_*.pdf (議案)
  if (/(contents|_C\.pdf|_S\.pdf|_T\.pdf|_G_)/i.test(filename)) return true;
  return false;
}

/**
 * 平成期の会議録本文ファイル名をパースする。
 * パターン: H{年}_{回数}[R]_{号数}.pdf
 * 例: H19_1_1.pdf, H19_1R_1.pdf
 */
export function parseHeiseiFilename(filename: string): {
  westernYear: number;
  session: number;
  isExtraordinary: boolean;
  issue: number;
} | null {
  const m = /^H(\d{2})_(\d+)(R)?_(\d+)\.pdf$/i.exec(filename);
  if (!m) return null;
  const heiseiYear = parseInt(m[1]!, 10);
  const session = parseInt(m[2]!, 10);
  const isExtraordinary = !!m[3];
  const issue = parseInt(m[4]!, 10);
  const westernYear = 1988 + heiseiYear;
  return { westernYear, session, isExtraordinary, issue };
}

/**
 * 令和期の会議録本文ファイル名をパースする。
 * パターン: R{年}_{回数}(T|R)_{号数(ゼロ埋め)}.pdf
 * 例: R07_1T_01.pdf, R07_1R_01.pdf
 */
export function parseReiwaFilename(filename: string): {
  westernYear: number;
  session: number;
  isExtraordinary: boolean;
  issue: number;
} | null {
  const m = /^R(\d{2})_(\d+)(T|R)_(\d{2})\.pdf$/i.exec(filename);
  if (!m) return null;
  const reiwaYear = parseInt(m[1]!, 10);
  const session = parseInt(m[2]!, 10);
  const isExtraordinary = m[3]!.toUpperCase() === "R";
  const issue = parseInt(m[4]!, 10);
  const westernYear = 2018 + reiwaYear;
  return { westernYear, session, isExtraordinary, issue };
}

/**
 * PDF ファイル名からメタ情報をパースする。
 * 平成期・令和期の両パターンに対応。
 */
export function parsePdfFilename(filename: string): {
  westernYear: number;
  session: number;
  isExtraordinary: boolean;
  issue: number;
} | null {
  return parseHeiseiFilename(filename) ?? parseReiwaFilename(filename);
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
