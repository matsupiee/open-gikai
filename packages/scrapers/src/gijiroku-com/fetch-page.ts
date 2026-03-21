/**
 * gijiroku.com 共通の HTTP fetch ユーティリティ
 *
 * HTTPS で接続できない gijiroku.com サイト（藤枝市、伊丹市等）に対応するため、
 * HTTPS → HTTP のフォールバックを行う。
 */

import { decodeShiftJis } from "./decode-shift-jis";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/**
 * Shift_JIS エンコーディングのページを取得し、UTF-8 文字列として返す。
 *
 * HTTPS URL で接続エラーが発生した場合、HTTP にフォールバックして再試行する。
 */
export async function fetchShiftJisPage(
  url: string
): Promise<string | null> {
  const res = await fetchWithHttpFallback(url);
  if (!res) return null;

  const bytes = new Uint8Array(await res.arrayBuffer());
  return decodeShiftJis(bytes);
}

/**
 * fetch を実行し、HTTPS で接続エラーの場合は HTTP にフォールバックする。
 */
async function fetchWithHttpFallback(
  url: string
): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.ok) return res;
    return null;
  } catch {
    // HTTPS で接続失敗した場合、HTTP にフォールバック
    if (url.startsWith("https://")) {
      const httpUrl = url.replace(/^https:\/\//, "http://");
      try {
        const res = await fetch(httpUrl, {
          headers: { "User-Agent": USER_AGENT },
        });
        if (res.ok) return res;
      } catch {
        // HTTP でも失敗
      }
    }
    return null;
  }
}
