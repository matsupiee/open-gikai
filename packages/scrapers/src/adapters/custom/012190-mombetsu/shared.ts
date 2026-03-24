/**
 * 紋別市議会 — 共通ユーティリティ
 *
 * サイト: https://mombetsu.jp/gikai/minutes/
 * PDF ベースの議事録公開。カテゴリツリー（種別→年度→content）を辿って PDF を収集する。
 */

export const BASE_ORIGIN = "https://mombetsu.jp";
export const BASE_URL = `${BASE_ORIGIN}/gikai/minutes/`;

/** 会議種別カテゴリ ID */
export const MEETING_TYPE_CATEGORIES = [
  { categoryId: "124", label: "定例会" },
  { categoryId: "125", label: "臨時会" },
  { categoryId: "126", label: "委員会" },
  { categoryId: "127", label: "特別委員会" },
] as const;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(label: string): string {
  if (label.includes("委員会")) return "committee";
  if (label.includes("臨時会")) return "extraordinary";
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
      console.warn(`[012190-mombetsu] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[012190-mombetsu] fetchPage error: ${url}`,
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
      console.warn(`[012190-mombetsu] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[012190-mombetsu] fetchBinary error: ${url}`,
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
 * e.g., "令和7年" → 2025, "令和７年" → 2025, "平成29年" → 2017
 *       "令和元年" → 2019, "平成元年" → 1989
 */
export function eraToWesternYear(eraText: string): number | null {
  const normalized = normalizeNumbers(eraText);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearStr] = match;
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "content_20250221_135713.pdf" → "content_20250221_135713"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}

/** HTML タグを除去してプレーンテキストを返す */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}
