/**
 * 浦河町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.urakawa.hokkaido.jp/gyosei/council/
 * 自治体コード: 016071
 *
 * 全会議録は PDF ファイルで提供される。
 * 審議の結果トップ → 年度別 → 会議種別 → 詳細ページ → PDF の4段階クロール。
 */

export const BASE_ORIGIN = "https://www.town.urakawa.hokkaido.jp";
export const TOP_CATEGORY = "220";
export const TOP_URL = `${BASE_ORIGIN}/gyosei/council/?category=${TOP_CATEGORY}`;

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
 * 和暦テキストから西暦年を返す。
 * e.g., "令和6年" → 2024, "令和元年" → 2019, "平成31年" → 2019
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

/**
 * 全角数字を半角数字に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 会議タイプを検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * カテゴリ URL を組み立てる。
 */
export function buildCategoryUrl(categoryId: string): string {
  return `${BASE_ORIGIN}/gyosei/council/?category=${categoryId}`;
}

/**
 * コンテンツ URL を組み立てる。
 */
export function buildContentUrl(contentId: string): string {
  return `${BASE_ORIGIN}/gyosei/council/?content=${contentId}`;
}

/**
 * 相対 PDF パスを絶対 URL に変換する。
 * e.g., "../../assets/images/content/content_20241210_150000.pdf"
 *   → "https://www.town.urakawa.hokkaido.jp/gyosei/assets/images/content/content_20241210_150000.pdf"
 */
export function normalizePdfUrl(pdfPath: string): string {
  if (pdfPath.startsWith("http")) return pdfPath;
  // ../../assets/... は /gyosei/council/ から2つ上に遡ると /gyosei/assets/...
  const normalized = pdfPath.replace(/^(?:\.\.\/)+/, "/gyosei/");
  return `${BASE_ORIGIN}${normalized}`;
}
