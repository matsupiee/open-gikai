/**
 * 嘉島町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.kumamoto-kashima.lg.jp/q/list/282.html
 * 自治体コード: 434426
 */

export const BASE_ORIGIN = "https://www.town.kumamoto-kashima.lg.jp";

/** 会議録一覧ページ URL */
export const LIST_URL = `${BASE_ORIGIN}/q/list/282.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** fetch して EUC-JP を UTF-8 にデコードしたテキストを返す */
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
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("euc-jp");
    return decoder.decode(buffer);
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** バイナリデータを fetch して返す（PDF ダウンロード用） */
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
 * 公開日文字列から YYYY-MM-DD 形式に変換する。
 *
 * 対応フォーマット:
 *   - YYYY年M月D日 → "2024年12月10日" → "2024-12-10"
 *   - YYYY/MM/DD  → "2025/11/26" → "2025-11-26"
 *
 * パース不能な場合は null を返す。
 */
export function parsePublishedDate(text: string): string | null {
  // YYYY年M月D日 形式
  const jp = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jp) {
    const month = jp[2]!.padStart(2, "0");
    const day = jp[3]!.padStart(2, "0");
    return `${jp[1]}-${month}-${day}`;
  }

  // YYYY/MM/DD 形式
  const slash = text.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (slash) {
    return `${slash[1]}-${slash[2]}-${slash[3]}`;
  }

  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
