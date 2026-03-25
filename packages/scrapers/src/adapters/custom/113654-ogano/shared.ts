/**
 * 小鹿野町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ogano.lg.jp/menyu/gikai/sinkaigiroku/index.html
 * 独自 HTML 公開（フレームセット構成）。文字コード: Shift_JIS。
 * 会議録形式: HTML テキスト形式（PDF なし）。
 */

export const BASE_URL =
  "https://www.town.ogano.lg.jp/menyu/gikai/sinkaigiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 全角数字を半角数字に変換する */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("全員協議会")) return "committee";
  return "plenary";
}

/**
 * ファイル名から西暦年を導出する。
 *
 * e.g., "R0703T.html" -> 2025 (令和7年)
 *       "H2903T.html" -> 2017 (平成29年)
 *       "R0106T.html" -> 2019 (令和元年)
 */
export function fileNameToYear(fileName: string): number | null {
  const match = fileName.match(/^([RH])(\d{2})\d{2}[A-Z][\d]*/i);
  if (!match) return null;

  const era = match[1]!.toUpperCase();
  const eraYear = parseInt(match[2]!, 10);

  if (era === "R") return eraYear + 2018;
  if (era === "H") return eraYear + 1988;
  return null;
}

/**
 * ファイル名から月を導出する。
 *
 * e.g., "R0703T.html" -> 3
 *       "H2906T.html" -> 6
 */
export function fileNameToMonth(fileName: string): number | null {
  const match = fileName.match(/^[RH]\d{2}(\d{2})[A-Z]/i);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

/**
 * ファイル名から会議種別を検出する。
 *
 * T -> 定例会, R -> 臨時会, Z -> 全員協議会
 */
export function fileNameToSessionType(
  fileName: string,
): "定例会" | "臨時会" | "全員協議会" | null {
  const match = fileName.match(/^[RH]\d{4}([TRZ])/i);
  if (!match) return null;

  const code = match[1]!.toUpperCase();
  if (code === "T") return "定例会";
  if (code === "R") return "臨時会";
  if (code === "Z") return "全員協議会";
  return null;
}

/** fetch して Shift_JIS -> UTF-8 テキストを返す */
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
    const buf = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buf);
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（バイナリ用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
