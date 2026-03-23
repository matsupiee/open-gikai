/**
 * 大山町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.daisen.jp/gikai/9/
 * 自治体コード: 313866
 *
 * 大山町は PDF 形式で議事録を公開している。
 * 会議録トップ（/gikai/9/）から年度別ページへのリンクを取得し、
 * 各年度ページから臨時会の PDF リンク、定例会のサブページリンクを収集する。
 */

export const BASE_ORIGIN = "https://www.daisen.jp";
export const TOP_PATH = "/gikai/9/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 和暦テキスト（「令和N年」「平成N年」）から西暦年を返す。
 */
export function warekiToSeireki(text: string): number | null {
  const match = text.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  return era === "令和" ? 2018 + eraYear : 1988 + eraYear;
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[313866-daisen] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[313866-daisen] fetchPage error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF 用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`[313866-daisen] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[313866-daisen] fetchBinary error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * リンクテキストから会議名と日付情報を抽出する。
 *
 * 対応パターン:
 *   臨時会: "第1回大山町議会臨時会（1月20日）"
 *   定例会（年度ページ上）: "第2回大山町議会定例会（2月28日～3月21日）"
 *   定例会（サブページ上）: "第1日（2月28日）"
 *   旧形式定例会: "平成25年第2回定例会第1日（3月4日）"
 */

/** 臨時会リンクテキストのパターン（「大山町議会」は省略可） */
export const RINJI_PATTERN =
  /第(\d+)回(?:大山町議会)?臨時会（(\d+)月(\d+)日）/;

/** 定例会リンクテキストのパターン（年度ページ上） */
export const TEIREI_PATTERN =
  /第(\d+)回大山町議会定例会（(\d+)月(\d+)日～(\d+)月(\d+)日）/;

/** 定例会の各日程リンクテキストのパターン（サブページ上） */
export const DAY_PATTERN = /第(\d+)日（(\d+)月(\d+)日）/;

/** 旧形式の定例会リンクテキストのパターン */
export const OLD_TEIREI_PATTERN =
  /(?:平成\d+年)?第(\d+)回定例会第(\d+)日（(\d+)月(\d+)日）/;

/**
 * 月と日から YYYY-MM-DD を生成する。
 * 年度ベースの月（1-3月は翌年度扱い）を考慮する。
 */
export function buildDate(
  fiscalYear: number,
  month: number,
  day: number,
): string {
  // 1-3月は翌年（年度跨ぎ）
  const calendarYear = month <= 3 ? fiscalYear + 1 : fiscalYear;
  return `${calendarYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * href を絶対 URL に変換する。
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}
