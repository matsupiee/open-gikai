/**
 * 双葉町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.fukushima-futaba.lg.jp/6178.htm
 * 自治体コード: 075469
 */

export const BASE_ORIGIN = "https://www.town.fukushima-futaba.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("協議会")) return "committee";
  if (title.includes("審査会")) return "committee";
  if (title.includes("調査会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
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
      console.warn(`[075469-futaba] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[075469-futaba] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリを返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `[075469-futaba] fetchBinary failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[075469-futaba] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** 全角数字を半角に変換する */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/** 和暦年を西暦に変換する */
export function convertWarekiYear(era: string, yearStr: string): number | null {
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  return null;
}

/** 絶対 URL に正規化する */
export function toAbsoluteUrl(href: string, pageUrl = BASE_ORIGIN): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return new URL(href, pageUrl).toString();
}

/** リンクラベルから該当する西暦年の候補を抽出する */
export function extractYearsFromLabel(label: string): number[] {
  const normalized = toHalfWidth(label).replace(/[\s　]+/g, "");
  const years: number[] = [];

  for (const match of normalized.matchAll(/(令和|平成)(元|\d+)年/g)) {
    const year = convertWarekiYear(match[1]!, match[2]!);
    if (year !== null && !years.includes(year)) {
      years.push(year);
    }
  }

  return years;
}

/** PDF URL から externalId を生成する */
export function buildExternalId(pdfUrl: string): string | null {
  const pathname = new URL(pdfUrl).pathname;
  const match = pathname.match(/\/secure\/(\d+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `futaba_${match[1]}_${match[2]}`;
}
