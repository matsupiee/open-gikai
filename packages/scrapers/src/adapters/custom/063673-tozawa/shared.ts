/**
 * 戸沢村議会 — 共通ユーティリティ
 *
 * サイト: https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/council.html
 * 自治体コード: 063673
 *
 * DiscussVision 社 smart.discussvision.net による映像配信システム。
 * テナント ID: 486
 * callback パラメータを省略すると JSON 形式で直接返るため、JSONP パースは不要。
 * 全期間にわたってテキスト会議録は提供されていない（映像配信専用）。
 */

export const BASE_ORIGIN = "https://smart.discussvision.net";
export const TENANT_ID = 486;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して JSON を返す */
export async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[063673-tozawa] fetchJson failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(
      `[063673-tozawa] fetchJson error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
