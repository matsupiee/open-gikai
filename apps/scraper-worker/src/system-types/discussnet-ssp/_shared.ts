/**
 * DiscussNet SSP 共通ユーティリティ
 */

const API_BASE = "https://ssp.kaigiroku.net/dnp/search";
export const SSP_HOST = "https://ssp.kaigiroku.net";
export const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/** POST リクエストを送信し、JSON を返す。失敗時は null を返す。 */
export async function postJson<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<T | null> {
  const body = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)] as [string, string])
  );
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: body.toString(),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 全角数字を半角に正規化する */
export function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}
