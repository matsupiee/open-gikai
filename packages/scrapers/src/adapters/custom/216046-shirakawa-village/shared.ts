/**
 * 白川村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.shirakawa.lg.jp/1098.htm
 * PDF ベースの資料公開（発言全文の会議録は公開されていない）。
 * 議会トップページとページネーション（pfromid を 4 ずつ増加）から PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.vill.shirakawa.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。「元」にも対応。
 * e.g., "令和7" → 2025, "令和元" → 2019, "平成30" → 2018
 */
export function eraToWestern(era: string, eraYearStr: string): number | null {
  const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);
  if (Number.isNaN(eraYear)) return null;
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * e.g., "令和7年3月4日" → "2025-03-04"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const westernYear = eraToWestern(match[1]!, match[2]!);
  if (!westernYear) return null;

  const month = Number(match[3]!);
  const day = Number(match[4]!);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストから会議の開催年を推測する。
 * 「令和7年」「令和6年」等のパターンから西暦年を返す。
 */
export function extractYearFromText(text: string): number | null {
  const match = text.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWestern(match[1]!, match[2]!);
}

/**
 * PDF ファイル名から種別を判定する。
 */
export type PdfKind = "nittei" | "gian" | "ippan" | "gikai" | "other";

export function classifyPdfKind(filename: string): PdfKind {
  const lower = filename.toLowerCase();
  if (lower.includes("nittei")) return "nittei";
  if (lower.includes("gian")) return "gian";
  if (lower.includes("ippan") || lower.includes("shitsumon")) return "ippan";
  if (lower.includes("gikai")) return "gikai";
  return "other";
}
