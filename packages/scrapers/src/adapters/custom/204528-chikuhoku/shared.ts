/**
 * 筑北村議会（実態: 筑西市議会） — 共通ユーティリティ
 *
 * DiscussVision Smart API を使用して議会映像・議題データを取得する。
 * テナント: chikusei (tenant_id=516)
 *
 * 自治体コード: 204528
 */

export const TENANT_ID = 516;
export const API_BASE = "https://smart.discussvision.net/dvsapi";
export const VIEW_BASE =
  "https://smart.discussvision.net/smart/tenant/chikusei/WebView";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(label: string): string {
  if (label.includes("委員会")) return "committee";
  if (label.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** GET リクエストで JSON を取得する */
export async function fetchJson<T>(
  endpoint: string,
  params: Record<string, string | number>,
): Promise<T | null> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn(
      `[204528-chikuhoku] fetchJson failed: ${url.toString()}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * schedule の label から日付を抽出する。
 *
 * label 例: "03月01日　一般質問", "01月16日　開会"
 * council の year フィールドから年を取得し、YYYY-MM-DD を返す。
 */
export function extractDateFromScheduleLabel(
  label: string,
  councilYear: string,
): string | null {
  // label: "03月01日　一般質問" → month=03, day=01
  const m = label.match(/(\d{2})月(\d{2})日/);
  if (!m?.[1] || !m[2]) return null;

  // councilYear: "2024-03-25" → year=2024
  const yearMatch = councilYear.match(/^(\d{4})/);
  if (!yearMatch?.[1]) return null;

  return `${yearMatch[1]}-${m[1]}-${m[2]}`;
}

/**
 * 全角数字を半角に正規化する。
 */
export function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}
