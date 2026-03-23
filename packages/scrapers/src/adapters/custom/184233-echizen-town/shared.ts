/**
 * 越前町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.echizen.fukui.jp/chousei/04/06/index.html
 * 自治体コード: 184233
 *
 * 会議録は PDF 形式で直接公開。検索機能なし。
 * 一覧ページに全会議録へのリンクが単一ページに列挙されている。
 */

export const BASE_ORIGIN = "https://www.town.echizen.fukui.jp";
export const BASE_PATH = "/chousei/04/06";
export const INDEX_URL = `${BASE_ORIGIN}${BASE_PATH}/index.html`;

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
 * リンクテキストから会議種別を判別する。
 * - 一般質問会議録: "一般質問" を含む
 * - 本会議議事録: それ以外
 */
export function isGeneralQuestion(title: string): boolean {
  return title.includes("一般質問");
}

/**
 * 和暦タイトルから西暦年と月を抽出する。
 *
 * 対応パターン:
 *   令和X年X月 越前町議会定例会 議事録
 *   令和X年第X回越前町議会臨時会 議事録
 *   令和X年X月定例会・一般質問会議録
 *   平成XX年X月 越前町議会定例会 議事録
 *   平成31年第1回 越前町議会臨時会 議事録
 */
export function extractYearMonth(title: string): { year: number; month: number | null } {
  // 令和
  const reiwaMatch = title.match(/令和(元|\d+)年(\d+)月/);
  if (reiwaMatch) {
    const nengo = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const year = 2018 + nengo;
    const month = parseInt(reiwaMatch[2]!, 10);
    return { year, month };
  }

  // 令和 臨時会 (月なし, 第N回のみ)
  const reiwaNoMonthMatch = title.match(/令和(元|\d+)年/);
  if (reiwaNoMonthMatch) {
    const nengo = reiwaNoMonthMatch[1] === "元" ? 1 : parseInt(reiwaNoMonthMatch[1]!, 10);
    const year = 2018 + nengo;
    return { year, month: null };
  }

  // 平成
  const heiseiMatch = title.match(/平成(\d+)年(\d+)月/);
  if (heiseiMatch) {
    const year = 1988 + parseInt(heiseiMatch[1]!, 10);
    const month = parseInt(heiseiMatch[2]!, 10);
    return { year, month };
  }

  // 平成 臨時会 (月なし)
  const heiseiNoMonthMatch = title.match(/平成(\d+)年/);
  if (heiseiNoMonthMatch) {
    const year = 1988 + parseInt(heiseiNoMonthMatch[1]!, 10);
    return { year, month: null };
  }

  return { year: 0, month: null };
}

/**
 * 年・月から YYYY-MM-01 形式の日付文字列を構築する。
 * 月が不明な場合は YYYY-01-01 を返す。
 */
export function buildHeldOn(year: number, month: number | null): string {
  if (!year) return "";
  const m = month ?? 1;
  return `${year}-${String(m).padStart(2, "0")}-01`;
}

/**
 * 相対パスを絶対 URL に変換する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  // 相対パス: p009573_d/fil/070903_first.pdf
  return `${BASE_ORIGIN}${BASE_PATH}/${href}`;
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
