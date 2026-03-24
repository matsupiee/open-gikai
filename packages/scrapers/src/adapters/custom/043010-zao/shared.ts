/**
 * 蔵王町議会（宮城県）会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.zao.miyagi.jp/kurashi_guide/gikai_senkyo/gikai/gijiroku/index.html
 * 自治体コード: 043010
 *
 * PDF 公開（令和7年以降）と HTML フレームセット公開（平成23年〜令和6年）の混在形式。
 */

export const BASE_ORIGIN = "https://www.town.zao.miyagi.jp";
export const TOP_PAGE_URL = `${BASE_ORIGIN}/kurashi_guide/gikai_senkyo/gikai/gijiroku/index.html`;

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

/** fetch して Shift_JIS ページを UTF-8 に変換して返す */
export async function fetchShiftJisPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchShiftJisPage failed: ${url} status=${res.status}`);
      return null;
    }
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("shift-jis");
    return decoder.decode(buffer);
  } catch (e) {
    console.warn(
      `fetchShiftJisPage error: ${url}`,
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
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成31年" → 2019
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
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * テキストから開催日 YYYY-MM-DD を解析する。
 * 全角・半角数字両方に対応。
 * 解析できない場合は null を返す。
 */
export function parseDateFromText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const fullMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!fullMatch) return null;

  const year = eraToWesternYear(`${fullMatch[1]}${fullMatch[2]}年`);
  if (!year) return null;

  const month = parseInt(fullMatch[3]!, 10);
  const day = parseInt(fullMatch[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF ファイル名 r{YYMMDD}.pdf から開催日 YYYY-MM-DD を解析する。
 * 例: r070702.pdf → 令和7年7月2日 → 2025-07-02
 */
export function parseDateFromPdfFilename(filename: string): string | null {
  const match = filename.match(/r(\d{2})(\d{2})(\d{2})\.pdf$/i);
  if (!match) return null;

  const eraYear = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  // 令和として計算（令和1年=2019年）
  const westernYear = eraYear + 2018;

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
