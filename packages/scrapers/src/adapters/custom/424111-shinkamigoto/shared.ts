/**
 * 新上五島町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://official.shinkamigoto.net/goto_chosei.php?wcid=l00002x4
 * 自治体コード: 424111
 */

export const BASE_ORIGIN = "https://official.shinkamigoto.net";

/** 会議録一覧ページ URL */
export const LIST_URL = `${BASE_ORIGIN}/goto_chosei.php?wcid=l00002x4`;

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
 * 会議タイトルから会議種別を判定する。
 * - 臨時 → extraordinary
 * - 定例 → plenary
 * - 委員会 → committee
 * - それ以外 → plenary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 和暦年テキストから西暦年に変換する。
 * 「令和6年」→ 2024, 「令和元年」→ 2019
 * 全角数字にも対応する。
 */
export function convertWarekiToWesternYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}

/**
 * HTML エンティティをデコードする。
 * &amp; → & など URL に含まれるエンティティを正規化する。
 */
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * 年度ページのリンクテキストから開催日を解析する。
 * 例: "第１回臨時会（R6.1.31）" → "2024-01-31"
 * 例: "第１回定例会（R6.3.5～15）" → "2024-03-05"（開始日のみ）
 * 解析できない場合は null を返す。
 */
export function parseDateFromLinkText(
  linkText: string,
  year: number,
): string | null {
  const normalized = toHalfWidth(linkText);

  // パターン: （Rx.M.D） または （Rx.M.D～D） 形式
  // x は元号年（例: R6 = 令和6年 = 2024年）
  const dateMatch = normalized.match(/[（(][RHrh]\d+\.(\d{1,2})\.(\d{1,2})/);
  if (dateMatch) {
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}
