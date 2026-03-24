/**
 * 木城町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/index.html
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.kijo.lg.jp";
export const TOP_PAGE_URL =
  "https://www.town.kijo.lg.jp/gyouseizyouhou/gikai/kaigiroku/index.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(section: string): string {
  if (section.includes("臨時")) return "extraordinary";
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
      console.warn(`[454044-kijo] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[454044-kijo] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
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
      console.warn(`[454044-kijo] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[454044-kijo] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 西暦年を和暦テキスト（ラベルに含まれる文字列）に変換する。
 * e.g., 2025 → ["令和7年", "令和７年"], 2019 → ["令和元年", "平成31年", "平成３１年"]
 */
export function toJapaneseEraLabels(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    const rYear = year - 2018;
    results.push(`令和${rYear}年`);
    // 全角数字バリアント
    const fullWidth = String(rYear)
      .split("")
      .map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
      .join("");
    results.push(`令和${fullWidth}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
    results.push("平成３１年");
    // 令和元年【平成31年】 のような表記
    results.push("令和元年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    const label = eraYear === 1 ? "平成元年" : `平成${eraYear}年`;
    results.push(label);
    // 全角バリアント
    if (eraYear !== 1) {
      const fullWidth = String(eraYear)
        .split("")
        .map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
        .join("");
      results.push(`平成${fullWidth}年`);
    }
  }

  return results;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "//www.town.kijo.lg.jp/material/files/group/5/R6-1.pdf" → "R6-1"
 */
export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
