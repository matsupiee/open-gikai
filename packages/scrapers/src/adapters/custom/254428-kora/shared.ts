/**
 * 甲良町議会 — 共通ユーティリティ
 *
 * サイト: https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/index.html
 * 自治体コード: 254428
 *
 * 会議録は PDF 形式で年度別ページに直接公開。検索機能なし。
 * インデックスページから年度別ページ URL を取得し、
 * 各年度ページに掲載された会議録 PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.kouratown.jp";
export const INDEX_URL = `${BASE_ORIGIN}/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/index.html`;

/** 年度別ページが含むベースパス */
export const YEAR_PAGE_BASE_PATH =
  "/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/";

/** 会議録 PDF が格納されているパス（このパスを含む href のみ収集） */
export const PDF_PATH_FILTER = "material/files/group/17/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 会議タイトルから年を抽出して西暦に変換する。
 *
 * 対応パターン:
 *   令和X年（X月）甲良町議会定例会
 *   令和元年（X月）甲良町議会臨時会
 *   平成XX年（X月）甲良町議会定例会
 */
export function extractYearFromTitle(title: string): number | null {
  // 令和
  const reiwaMatch = title.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const nengo = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return 2018 + nengo;
  }

  // 平成
  const heiseiMatch = title.match(/平成(\d+)年/);
  if (heiseiMatch) {
    return 1988 + parseInt(heiseiMatch[1]!, 10);
  }

  return null;
}

/**
 * 会議タイトルから月を抽出する。
 * 「3月定例会」「令和6年6月」のような形式に対応。
 * 月が不明な場合は null を返す。
 */
export function extractMonthFromTitle(title: string): number | null {
  const monthMatch = title.match(/(\d+)月/);
  if (monthMatch?.[1]) {
    return parseInt(monthMatch[1], 10);
  }
  return null;
}

/**
 * 会議名から heldOn (YYYY-MM-DD) を推定する。
 * 月が不明な場合は null を返す。
 */
export function buildHeldOn(year: number, month: number | null): string | null {
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * href を絶対 URL に変換する。
 * "//" 始まりや相対パスを正規化する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/${href}`;
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

/** バイナリデータを取得する */
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
