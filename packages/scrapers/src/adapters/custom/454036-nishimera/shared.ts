/**
 * 西米良村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.nishimera.lg.jp/village/category/c-00-admininfo/c-03/c-03-02
 * WordPress サイトで年度別ページに PDF を公開する形式。
 * カテゴリページ → 年度別記事ページ → PDF という2段階の構造。
 */

export const BASE_ORIGIN = "https://www.vill.nishimera.lg.jp";
export const CATEGORY_URL =
  "https://www.vill.nishimera.lg.jp/village/category/c-00-admininfo/c-03/c-03-02";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別記事 ID と西暦の対応マップ。
 * カテゴリページから動的に取得するが、既知の ID をフォールバックとして保持する。
 */
export const KNOWN_ARTICLE_IDS: { articleId: string; year: number }[] = [
  { articleId: "10002624", year: 2018 },
  { articleId: "10003249", year: 2019 },
  { articleId: "10003857", year: 2020 },
  { articleId: "10004399", year: 2021 },
  // 令和4年（2022年）の議事録ページは存在しない
  { articleId: "10005758", year: 2023 },
  { articleId: "10006493", year: 2024 },
  { articleId: "10006425", year: 2025 },
];

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦を西暦に変換する。
 * e.g., "令和", "6" → 2024, "令和", "元" → 2019
 */
export function convertJapaneseEra(
  era: string,
  eraYearStr: string,
): number | null {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return null;
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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
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
 * PDF URL から externalId を生成する。
 * e.g., "/village/wp-content/uploads/2024/03/abc123def456.pdf" → "nishimera_abc123def456"
 */
export function extractExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `nishimera_${match[1]}`;
}
