/**
 * DiscussNet SSP 共通ユーティリティ
 */

const DEFAULT_API_BASE = "https://ssp.kaigiroku.net/dnp/search";
export const SSP_HOST = "https://ssp.kaigiroku.net";
export const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/** baseUrl からホスト部分を抽出し、API ベース URL を構築する */
export function buildApiBase(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.host}/dnp/search`;
}

/** baseUrl からホスト部分（protocol + host）を抽出する */
export function extractHost(baseUrl: string): string {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.host}`;
}

/** POST リクエストを送信し、JSON を返す。失敗時は null を返す。 */
export async function postJson<T>(
  endpoint: string,
  params: Record<string, string | number>,
  apiBase?: string
): Promise<T | null> {
  const base = apiBase ?? DEFAULT_API_BASE;
  const body = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)] as [string, string])
  );
  try {
    const res = await fetch(`${base}/${endpoint}`, {
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
