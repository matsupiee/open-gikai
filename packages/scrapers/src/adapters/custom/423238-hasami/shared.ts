/**
 * 波佐見町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.hasami.lg.jp/machi/soshiki/gikai/2/3/4/4358.html
 * 自治体コード: 423238
 *
 * PDF 形式で年度別・定例会/臨時会別に直接提供。
 * 会議録検索システムは存在せず、一覧ページから PDF を直接ダウンロードする方式。
 */

export const BASE_ORIGIN = "https://www.town.hasami.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * - 臨時会 → extraordinary
 * - 委員会 → committee
 * - 定例会 → plenary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
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
 * 全角数字を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦の年見出しから西暦年を返す。
 * 「令和5年」→ 2023, 「令和元年」→ 2019, 「平成30年」→ 2018
 * 全角数字にも対応する。
 */
export function convertHeadingToWesternYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  // 令和
  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  // 平成
  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}

/**
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 *
 * 波佐見町の PDF は年と月日が分離した構造になっている:
 *   - 文書タイトル: 「令和元年第2回(6月)波佐見町議会定例会」
 *   - 開会宣言: 「令和元年第2回波佐見町議会定例会を開会します」
 *   - 日目ヘッダー: 「第1日目（6月12日）」
 *
 * 戦略:
 *   1. 文書冒頭から和暦年（令和X年 or 平成X年）を抽出して西暦に変換
 *   2. 「第1日目（M月D日）」パターンから開催月日を抽出
 *   3. 両者を結合して YYYY-MM-DD を返す
 *
 * 全角数字にも対応する。
 */
export function extractHeldOnFromText(text: string): string | null {
  const normalized = toHalfWidth(text);

  // 1. 和暦年を抽出（文書冒頭のタイトルまたは開会宣言から）
  const yearMatch = normalized.match(/(令和|平成)\s*(元|\d+)\s*年/);
  if (!yearMatch) return null;

  const era = yearMatch[1]!;
  const eraYear = yearMatch[2] === "元" ? 1 : Number(yearMatch[2]);
  const baseYear = era === "令和" ? 2018 : 1988;
  const westernYear = baseYear + eraYear;

  // 2. 「第1日目（M月D日）」パターンから開催月日を抽出
  const dayMatch = normalized.match(/第1日目[（(](\d+)月(\d+)日[）)]/);
  if (dayMatch) {
    const month = Number(dayMatch[1]);
    const day = Number(dayMatch[2]);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 3. フォールバック: 「開 会：令和 X年 M月 D日」パターン（臨時会で使用）
  const openMatch = normalized.match(
    /開\s*会[：:]\s*(令和|平成)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/,
  );
  if (openMatch) {
    const openEra = openMatch[1]!;
    const openEraYear = openMatch[2] === "元" ? 1 : Number(openMatch[2]);
    const openBaseYear = openEra === "令和" ? 2018 : 1988;
    const openWesternYear = openBaseYear + openEraYear;
    const month = Number(openMatch[3]);
    const day = Number(openMatch[4]);
    return `${openWesternYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}
