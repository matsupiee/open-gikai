/**
 * 斑鳩町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.ikaruga.nara.jp/0000000402.html
 * 自治体コード: 293440
 *
 * 全会議録は PDF ファイルで提供される。
 * 全年度が単一ページに掲載されており、8つの会議種別ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.ikaruga.nara.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 会議種別ページの定義。
 */
export interface PageDef {
  url: string;
  category: "plenary" | "committee";
  label: string;
}

/** 全一覧ページの定義 */
export const LIST_PAGES: PageDef[] = [
  { url: "/0000000419.html", category: "plenary", label: "本会議" },
  { url: "/0000000421.html", category: "committee", label: "総務常任委員会" },
  { url: "/0000000424.html", category: "committee", label: "厚生常任委員会" },
  { url: "/0000000426.html", category: "committee", label: "建設常任委員会" },
  { url: "/0000000428.html", category: "committee", label: "議会運営委員会" },
  { url: "/0000000433.html", category: "committee", label: "予算審査特別委員会" },
  { url: "/0000000430.html", category: "committee", label: "決算審査特別委員会" },
  { url: "/0000000434.html", category: "committee", label: "その他の委員会" },
];

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
const PDF_FETCH_TIMEOUT_MS = 60_000;

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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成13年" → 2001
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
