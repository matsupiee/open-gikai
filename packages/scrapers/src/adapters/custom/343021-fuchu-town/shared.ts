/**
 * 府中町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.fuchu.hiroshima.jp/site/assembly/list158.html
 * PDF ベースの議事録公開。年度別ページ → 会議別詳細ページ → PDF リンク。
 */

export const BASE_ORIGIN = "https://www.town.fuchu.hiroshima.jp";

/**
 * 和暦の開催日テキストから YYYY-MM-DD を返す。
 * e.g., "令和７年１２月１２日（金）" → "2025-12-12"
 * e.g., "令和元年５月１日" → "2019-05-01"
 */
export function parseDateText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度別一覧ページの URL マッピング。
 * トップページからのリンク抽出では ID が連番でないため、既知のマッピングを使用する。
 */
const YEAR_PAGE_MAP: Record<number, string> = {
  2026: "/site/assembly/list158-1652.html", // 令和8年
  2025: "/site/assembly/list158-1604.html", // 令和7年
  2024: "/site/assembly/list158-1557.html", // 令和6年
  2023: "/site/assembly/list158-1502.html", // 令和5年
  2022: "/site/assembly/list158-1438.html", // 令和4年
  2021: "/site/assembly/list158-1348.html", // 令和3年
  2020: "/site/assembly/list158-1236.html", // 令和2年
  2019: "/site/assembly/list158-1108.html", // 令和元年・平成31年
  2018: "/site/assembly/list158-658.html", // 平成30年
  2017: "/site/assembly/list158-363.html", // 平成29年
  2016: "/site/assembly/list158-365.html", // 平成28年
  2015: "/site/assembly/list158-366.html", // 平成27年
  2014: "/site/assembly/list158-367.html", // 平成26年
  2013: "/site/assembly/list158-368.html", // 平成25年
  2012: "/site/assembly/list158-369.html", // 平成24年
};

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
 * 年度別一覧ページの URL を返す。
 * マッピングに存在しない年度は null を返す。
 */
export function buildYearPageUrl(year: number): string | null {
  const path = YEAR_PAGE_MAP[year];
  if (!path) return null;
  return `${BASE_ORIGIN}${path}`;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/uploaded/attachment/31536.pdf" → "31536"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(\d+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
