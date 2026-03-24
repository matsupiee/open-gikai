/**
 * 湧別町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.yubetsu.lg.jp/administration/town/detail.html?content=516
 * PDF ベースの議事録公開。単一の一覧ページに全件が掲載。
 */

export const BASE_URL =
  "https://www.town.yubetsu.lg.jp/administration/town/detail.html?content=516";

/** PDF URL のベース */
export const PDF_BASE_URL = "https://www.town.yubetsu.lg.jp/common/img/content/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会") || title.includes("協議会")) return "committee";
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
      console.warn(`[015598-yubetsu] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[015598-yubetsu] fetchPage error: ${url}`,
      err instanceof Error ? err.message : err,
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
    if (!res.ok) {
      console.warn(`[015598-yubetsu] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[015598-yubetsu] fetchBinary error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 全角数字を半角数字に変換する。
 * e.g., "７" → "7", "２９" → "29"
 */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 全角数字にも対応する。「元年」表記にも対応する。
 * e.g., "令和7" → 2025, "令和７" → 2025, "平成30" → 2018
 *       "元" → 2019 (令和元年)
 */
export function eraToWesternYear(era: string, yearStr: string): number | null {
  const normalized = normalizeNumbers(yearStr);
  const eraYear = normalized === "元" ? 1 : parseInt(normalized, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 和暦テキスト全体（例: "令和7年1月10日"）から YYYY-MM-DD を返す。
 * 全角数字にも対応する。
 */
export function parseJapaneseDate(text: string): string | null {
  const normalized = normalizeNumbers(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 相対 PDF パスを絶対 URL に変換する。
 * e.g., "../../common/img/content/content_20250318_141316.pdf"
 *       → "https://www.town.yubetsu.lg.jp/common/img/content/content_20250318_141316.pdf"
 */
export function resolvePdfUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  // ../../common/img/content/xxx.pdf → absolute
  const filename = href.replace(/^.*\/([^/]+\.pdf)$/i, "$1");
  return `${PDF_BASE_URL}${filename}`;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "content_20250318_141316.pdf" → "content_20250318_141316"
 */
export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
