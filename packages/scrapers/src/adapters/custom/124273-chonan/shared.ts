/**
 * 長南町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.chonan.chiba.jp/chousei/gikai/
 * WordPress サイトで年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.chonan.chiba.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
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
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`[124273-chonan] fetchPage failed: ${url}`, err instanceof Error ? err.message : err);
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
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`[124273-chonan] fetchBinary failed: ${url}`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 西暦年を和暦テキストに変換する。
 * e.g., 2025 → ["令和7年", "令和７年"], 2019 → ["令和元年", "平成31年"]
 */
export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    const n = year - 2018;
    results.push(`令和${n}年`);
    // 全角数字版も追加（サイトでは「令和６年」等の表記が使われる）
    results.push(`令和${toFullWidth(n)}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
    results.push(`平成${toFullWidth(31)}年`);
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
    if (eraYear > 1) results.push(`平成${toFullWidth(eraYear)}年`);
  }

  return results;
}

/** 半角数字を全角数字に変換 */
function toFullWidth(n: number): string {
  return String(n).replace(/[0-9]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0xfee0)
  );
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/wp-content/uploads/2024/12/332c7593c8180c84dbc4c418f029455d.pdf"
 *     → "2024_12_332c7593c8180c84dbc4c418f029455d"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(\d{4})\/(\d{2})\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}_${match[3]}`;
}
