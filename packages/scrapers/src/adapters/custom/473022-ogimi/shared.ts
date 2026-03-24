/**
 * 大宜味村議会 会議録 — 共通ユーティリティ
 *
 * サイト: http://ogimi-gikai.sakura.ne.jp/site/%E4%BC%9A%E8%AD%B0%E9%8C%B2/
 * 自治体コード: 473022
 *
 * WordPress サイト上の PDF 公開。全年度が単一ページに列挙されている。
 * PDF ファイルは wp-content/uploads/ に格納。
 */

export const BASE_URL = "http://ogimi-gikai.sakura.ne.jp";

/** 会議録一覧ページ URL */
export const LIST_PAGE_URL = `${BASE_URL}/site/%E4%BC%9A%E8%AD%B0%E9%8C%B2/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const FILE_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会") || title.includes("予委") || title.includes("決委")) {
    return "committee";
  }
  if (title.includes("臨時会") || title.includes("臨")) return "extraordinary";
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
      console.warn(`[473022-ogimi] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[473022-ogimi] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（ファイルダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FILE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[473022-ogimi] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[473022-ogimi] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6" → 2024, "平成30" → 2018, "令和元" → 2019
 * 変換できない場合は null を返す。
 */
export function eraToWesternYear(era: string, yearInEra: number): number | null {
  if (era === "令和") return yearInEra + 2018;
  if (era === "平成") return yearInEra + 1988;
  if (era === "昭和") return yearInEra + 1925;
  return null;
}

/**
 * ファイル名・リンクテキストから西暦年を解析する。
 *
 * 対応パターン:
 *   - "R7" / "R６" → 令和 (R + 数字)
 *   - "H30" / "H２０" → 平成 (H + 数字)
 *   - 全角数字は半角に変換して処理
 *
 * 変換できない場合は null を返す。
 */
export function parseEraAbbr(text: string): number | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );

  // R7 / H30 形式
  const abbrMatch = normalized.match(/[RH](\d+)/);
  if (abbrMatch) {
    const num = parseInt(abbrMatch[1]!, 10);
    const isReiwa = normalized.includes("R");
    return eraToWesternYear(isReiwa ? "令和" : "平成", num);
  }

  return null;
}
