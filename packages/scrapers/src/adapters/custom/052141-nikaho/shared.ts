/**
 * にかほ市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.nikahoshigikai.akita.jp/
 * 自治体コード: 052141
 *
 * 全会議録は PDF ファイルで提供される。
 * タブ式の単一ページに全年度の PDF リンクが含まれる。
 */

export const BASE_ORIGIN = "https://www.nikahoshigikai.akita.jp";

/** 会議録一覧ページ URL */
export const CONFERENCE_URL = `${BASE_ORIGIN}/conference.html`;

/** タブ ID と年度コードのマッピング（tab01=平成17年〜tab21=令和7年） */
export const TAB_YEAR_MAP: Record<string, string> = {
  tab01: "17",
  tab02: "18",
  tab03: "19",
  tab04: "20",
  tab05: "21",
  tab06: "22",
  tab07: "23",
  tab08: "24",
  tab09: "25",
  tab10: "26",
  tab11: "27",
  tab12: "28",
  tab13: "29",
  tab14: "30",
  tab15: "31",
  tab16: "32",
  tab17: "33",
  tab18: "34",
  tab19: "35",
  tab20: "36",
  tab21: "r07",
};

/**
 * 年度コードから西暦年を返す。
 * e.g., "36" → 2024, "r07" → 2025, "31" → 2019
 */
export function yearCodeToWesternYear(yearCode: string): number | null {
  if (yearCode === "r07") return 2025;

  const num = parseInt(yearCode, 10);
  if (isNaN(num)) return null;

  // 平成17年(2005)〜平成31年/令和元年(2019), 令和2年(2020)〜
  // 数値コードは年度の下2桁で、平成/令和を判断する
  // 17〜31: 平成 → +1988
  // 32〜: 令和 → +2018
  if (num <= 31) return num + 1988;
  return num + 2018;
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
 * PDF ファイル名（デコード済み）から開催日 YYYY-MM-DD を解析する。
 *
 * 新形式: "令和7年第5回定例会1日目（9月2日）.pdf"
 * 特殊表記付き: "(訂正版)令和4年第5回定例会1日目（8月31日）.pdf"
 *              "令和5年第8回定例会3日目【副本】.pdf" (日付なし)
 *
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function parseDateFromFilename(filename: string): string | null {
  // パターン: 年号 + 月日（例: （9月2日））
  const dateMatch = filename.match(/(令和|平成)(元|\d+)年.*?[（(](\d+)月(\d+)日[）)]/);
  if (!dateMatch) return null;

  const year = eraToWesternYear(`${dateMatch[1]}${dateMatch[2]}年`);
  if (!year) return null;

  const month = parseInt(dateMatch[3]!, 10);
  const day = parseInt(dateMatch[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF ファイル名（デコード済み）から会議タイトルを抽出する。
 *
 * 例:
 *   "令和7年第5回定例会1日目（9月2日）.pdf" → "第5回定例会 1日目"
 *   "令和5年第3回臨時会（1月13日）.pdf" → "第3回臨時会"
 *   "(訂正版)令和4年第5回定例会1日目（8月31日）.pdf" → "第5回定例会 1日目"
 */
export function parseTitleFromFilename(filename: string): string | null {
  // 先頭の特殊表記を除去
  const cleaned = filename.replace(/^(?:\(訂正版\)|\[訂正版\])/, "").trim();

  // 年号部分を除去して会議名を抽出
  const match = cleaned.match(
    /(?:令和|平成)(?:元|\d+)年(第\d+回(?:定例会|臨時会|特別会)(?:\d+日目)?)/,
  );
  if (!match) return null;

  const base = match[1]!;
  // "第5回定例会1日目" → "第5回定例会 1日目"
  const withSpace = base.replace(/(定例会|臨時会|特別会)(\d+日目)/, "$1 $2");
  return withSpace;
}

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

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
