/**
 * 白老町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.shiraoi.hokkaido.jp/docs/page2014063000011.html
 * PDF ベースの議事録公開（年度別一覧ページ → PDF ダウンロード）
 */

export const BASE_URL = "https://www.town.shiraoi.hokkaido.jp";

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
    if (!res.ok) {
      console.warn(`[015784-shiraoi] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[015784-shiraoi] fetchPage error: ${url}`,
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
      console.warn(`[015784-shiraoi] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[015784-shiraoi] fetchBinary error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 全角数字を半角数字に変換する。
 */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 「元年」表記にも対応する。
 * e.g., "令和3" → 2021, "平成30" → 2018, "元" (令和) → 2019
 */
export function eraToWesternYear(era: string, yearStr: string): number | null {
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 和暦テキスト全体（例: "令和3年5月6日"）から YYYY-MM-DD を返す。
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
 * PDF ファイル名（日付形式: YYYY.MM.DD または YYYYMMDD...）から YYYY-MM-DD を返す。
 * e.g., "2024.06.14_____.pdf" → "2024-06-14"
 * e.g., "20210224giansetumei2gatu.pdf" → "2021-02-24"
 */
export function parseDateFromFilename(filename: string): string | null {
  // YYYY.MM.DD 形式
  const dotMatch = filename.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dotMatch) return `${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}`;

  // YYYYMMDD 形式（ファイル名先頭）
  const compactMatch = filename.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;

  return null;
}

/** HTML タグを除去してプレーンテキストを返す */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会") || title.includes("協議会") || title.includes("議会運営")) {
    return "committee";
  }
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}
