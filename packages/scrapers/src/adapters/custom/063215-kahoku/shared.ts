/**
 * 河北町議会 DiscussVision Smart — 共通ユーティリティ
 *
 * サイト: https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/council_1.html
 * API: JSONP 形式の REST API（/dvsapi/）
 */

export const BASE_ORIGIN = "https://smart.discussvision.net";
export const TENANT_ID = "396";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * JSONP レスポンスをパースして JSON オブジェクトを返す。
 *
 * レスポンス形式: `callbackName(JSON)`
 */
export function parseJsonp(text: string): unknown {
  const match = text.match(/^[^(]+\(([\s\S]*)\)$/);
  if (!match?.[1]) throw new Error(`Invalid JSONP response: ${text.slice(0, 100)}`);
  return JSON.parse(match[1]);
}

/**
 * JSONP API を fetch してパース済みオブジェクトを返す。
 */
export async function fetchJsonp(url: string): Promise<unknown | null> {
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}callback=cb`;
  try {
    const res = await fetch(fullUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchJsonp failed: ${fullUrl} status=${res.status}`);
      return null;
    }
    const text = await res.text();
    return parseJsonp(text);
  } catch (e) {
    console.warn(`fetchJsonp error: ${fullUrl}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(label: string): string {
  if (label.includes("委員会")) return "committee";
  if (label.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 年度ごとの会議一覧 API の URL を組み立てる */
export function buildCouncilListUrl(year: number): string {
  return `${BASE_ORIGIN}/dvsapi/councilrd/all?tenant_id=${TENANT_ID}&year=${year}&group_desc=false&council_desc=false&schedule_desc=false&council_id=&schedule_id=`;
}

/** schedule の label から開催日（MM月DD日）を抽出して YYYY-MM-DD に変換する */
export function parseScheduleDate(
  scheduleLabel: string,
  councilYear: string,
): string | null {
  // schedule label: "03月08日　一般質問"
  const match = scheduleLabel.match(/(\d{2})月(\d{2})日/);
  if (!match?.[1] || !match?.[2]) return null;
  // council.year は "YYYY-MM-DD" 形式の開始日
  const baseYear = councilYear.slice(0, 4);
  return `${baseYear}-${match[1]}-${match[2]}`;
}
