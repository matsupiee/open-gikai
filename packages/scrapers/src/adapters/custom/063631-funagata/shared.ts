/**
 * 舟形町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.funagata.yamagata.jp/li/gikai/010/
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.funagata.yamagata.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 会議タイトルから会議タイプを検出する。
 *
 * - 臨時会 → extraordinary
 * - 委員会（決算審査特別委員会、予算審査特別委員会等） → committee
 * - それ以外（定例会等） → plenary
 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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
      signal: AbortSignal.timeout(60_000),
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
 * 西暦年を和暦テキストに変換する。
 * e.g., 2025 → ["令和7年"], 2019 → ["令和元年", "平成31年"]
 */
export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    results.push(`令和${year - 2018}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
  }

  return results;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/s027/gikai/010/150/r07-01teirei-3.5-3.12.pdf" → "150_r07-01teirei-3.5-3.12"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(\d+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
