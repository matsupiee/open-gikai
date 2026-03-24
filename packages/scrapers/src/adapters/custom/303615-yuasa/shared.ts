/**
 * 湯浅町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.yuasa.wakayama.jp/site/gikai/
 * 自治体コード: 303615
 *
 * 湯浅町は汎用 CMS を使用した PDF ベースの議事録公開。
 * 定例会（カテゴリ 47）と臨時会（カテゴリ 48）が別カテゴリで管理されており、
 * 3段階クロール（トップ → 年度別一覧 → 会議詳細 → PDF）で取得する。
 */

export const BASE_ORIGIN = "https://www.town.yuasa.wakayama.jp";
export const GIKAI_TOP_PATH = "/site/gikai/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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

/** fetch して ArrayBuffer を返す（PDF 用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 和暦文字列から西暦年を変換する。
 * 「元」年に対応（令和元年 = 2019年、平成元年 = 1989年）。
 */
export function parseWarekiYear(era: string, eraYearStr: string): number | null {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  if (era === "昭和") return 1925 + eraYear;
  return null;
}

/**
 * 会議タイトルから開催日（YYYY-MM-DD）を抽出する。
 * 例: "令和7年12月定例会（第4回）" → null（日付情報なし）
 * 例: "令和7年3月定例会" → null（ページタイトルからは日付取得不可）
 *
 * 日付情報がない場合は null を返す。"1970-01-01" は絶対に返さない。
 */
export function parseDateFromTitle(title: string): string | null {
  // パターン: 令和7年12月3日 などの明示的な日付
  const dateMatch = title.match(
    /(令和|平成|昭和)(\d+|元)年(\d{1,2})月(\d{1,2})日/
  );
  if (dateMatch) {
    const year = parseWarekiYear(dateMatch[1]!, dateMatch[2]!);
    if (year === null) return null;
    const month = String(parseInt(dateMatch[3]!, 10)).padStart(2, "0");
    const day = String(parseInt(dateMatch[4]!, 10)).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * 年度別一覧 URL のカテゴリ番号から会議種別を返す。
 * list47-* → 定例会 (plenary)
 * list48-* → 臨時会 (extraordinary)
 */
export function meetingTypeFromListUrl(url: string): string {
  if (url.includes("list48-")) return "extraordinary";
  return "plenary";
}
