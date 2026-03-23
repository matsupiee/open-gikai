/**
 * 板柳町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.itayanagi.aomori.jp/gikai/teirei/index.html
 */

export const BASE_URL =
  "https://www.town.itayanagi.aomori.jp/gikai/teirei/";

const INDEX_URL = `${BASE_URL}index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
    console.warn(`[itayanagi] fetchPage failed: ${url}`, e);
    return null;
  }
}

/**
 * 一覧ページから年度別本会議ページのファイル名一覧を収集する。
 * 例: "honkaigi_R6.html", "2020-0312-1647-18.html"
 */
export function parseIndexPage(html: string): string[] {
  const uniqueFiles = new Set<string>();
  // honkaigi_R*, honkaigi_H*, 2020-0312 にマッチするhrefを収集
  const linkRegex = /href="([^"#]*(?:honkaigi_[RH]\d+\.html|2020-0312[^"#]*\.html))(?:#[^"]*)?"/gi;
  for (const match of html.matchAll(linkRegex)) {
    const filename = match[1];
    if (filename) uniqueFiles.add(filename);
  }
  return Array.from(uniqueFiles);
}

/** 一覧ページのURLを返す */
export function getIndexUrl(): string {
  return INDEX_URL;
}

/**
 * 和暦年月日文字列を YYYY-MM-DD に変換する。
 * 例: 「令和６年12月２日」→ "2024-12-02"
 * パース不可の場合は null を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );

  // 令和・平成・昭和
  const reiwaMatch = normalized.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (reiwaMatch) {
    const year = 2018 + parseInt(reiwaMatch[1]!, 10);
    const month = parseInt(reiwaMatch[2]!, 10);
    const day = parseInt(reiwaMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const heiseiMatch = normalized.match(/平成(\d+)年(\d+)月(\d+)日/);
  if (heiseiMatch) {
    const year = 1988 + parseInt(heiseiMatch[1]!, 10);
    const month = parseInt(heiseiMatch[2]!, 10);
    const day = parseInt(heiseiMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
