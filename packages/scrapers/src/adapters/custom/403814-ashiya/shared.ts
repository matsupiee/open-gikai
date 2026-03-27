/**
 * 芦屋町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ashiya.lg.jp/site/gikai/list433.html
 * 独自 CMS による HTML 公開 + PDF 添付。
 */

export const BASE_ORIGIN = "https://www.town.ashiya.lg.jp";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** 一定時間待機する */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 全角数字を半角に寄せる */
export function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 和暦の年を西暦に変換する。
 * 「令和元年」「平成元年」に対応する。
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidthDigits(text);
  const match = normalized.match(/(令和|平成)[\s　]*(元|\d+)[\s　]*年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  return null;
}

/**
 * 文字列中の「令和X年Y月Z日」「平成X年Y月Z日」を YYYY-MM-DD に変換する。
 * 全角数字と余分な空白に対応する。
 */
export function parseJapaneseDate(text: string): string | null {
  const normalized = toHalfWidthDigits(text);
  const match = normalized.match(
    /(令和|平成)[\s　]*(元|\d+)[\s　]*年[\s　]*(\d+)[\s　]*月[\s　]*(\d+)[\s　]*日/,
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** PDF 添付 ID を抽出する */
export function extractAttachmentId(url: string): string | null {
  const match = url.match(/\/attachment\/(\d+)\.pdf$/i);
  return match?.[1] ?? null;
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchPage failed: ${url} status=${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn(`fetchPage error: ${url}`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchBinary failed: ${url} status=${response.status}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(`fetchBinary error: ${url}`, error instanceof Error ? error.message : error);
    return null;
  }
}
