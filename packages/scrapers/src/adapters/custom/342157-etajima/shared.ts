/**
 * 江田島市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.etajima.hiroshima.jp/cms/categories/show/473
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.city.etajima.hiroshima.jp";

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
    console.warn(
      `[342157-etajima] fetchPage 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
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
    console.warn(
      `[342157-etajima] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 半角数字を全角数字に変換する。
 */
export function toFullWidth(s: string): string {
  return s.replace(/[0-9]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0xfee0)
  );
}

/**
 * 全角数字を半角数字に変換する。
 */
export function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 西暦年を和暦テキストに変換する（半角・全角の両方を返す）。
 * e.g., 2025 → ["令和7年", "令和７年"], 2019 → ["令和元年", "平成31年", "平成３１年"]
 */
export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    const n = String(year - 2018);
    results.push(`令和${n}年`);
    results.push(`令和${toFullWidth(n)}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
    results.push("平成３１年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    if (eraYear === 1) {
      results.push("平成元年");
    } else {
      const n = String(eraYear);
      results.push(`平成${n}年`);
      results.push(`平成${toFullWidth(n)}年`);
    }
  }

  return results;
}

/**
 * PDF URL からexternalId 用のキーを抽出する。
 * e.g., "/cms/files/uploads/xxx.pdf" → "xxx"
 * e.g., "/cms/migration/uploads/smartsection/yyy.pdf" → "yyy"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return decodeURIComponent(match[1]!);
}
