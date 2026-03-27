/**
 * 穴水町議会 — 共通ユーティリティ
 *
 * サイト:
 * - 現行: https://www.town.anamizu.lg.jp/site/gikai/100411.html
 * - バックナンバー: https://www.town.anamizu.lg.jp/site/gikai/100416.html
 *
 * 町公式サイトの HTML に PDF 会議録リンクを直接掲載している。
 */

export const BASE_ORIGIN = "https://www.town.anamizu.lg.jp";
export const BACKNUMBER_PATH = "/site/gikai/100416.html";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
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
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
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
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦テキストを西暦年に変換する。
 * 「令和X年」「平成X年」「令和元年」「平成元年」に対応。
 */
export function eraToYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  return null;
}

/** バックナンバーページ URL を返す */
export function buildBacknumberUrl(): string {
  return `${BASE_ORIGIN}${BACKNUMBER_PATH}`;
}

/** HTML 断片からテキストを抽出する */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x200b;|&#8203;/gi, "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** PDF リンクを絶対 URL に正規化する */
export function normalizePdfUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return href;
}
