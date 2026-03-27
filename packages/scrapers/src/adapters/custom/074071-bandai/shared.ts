/**
 * 磐梯町議会 会議録 — 共通ユーティリティ
 *
 * サイト:
 *   - 一覧: https://www.town.bandai.fukushima.jp/site/gikai/teieri-record.html
 *   - 詳細: BackShelf viewer
 */

export const BASE_ORIGIN = "https://www.town.bandai.fukushima.jp"
export const LIST_URL = `${BASE_ORIGIN}/site/gikai/teieri-record.html`

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)"

const FETCH_TIMEOUT_MS = 30_000

/** 会議タイプを判定する */
export function detectMeetingType(
  title: string,
): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee"
  if (title.includes("臨時")) return "extraordinary"
  return "plenary"
}

/** 全角数字を半角数字に変換する */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  )
}

/** 和暦表記から西暦年を抽出する */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text)
  const match = normalized.match(/(令和|平成)(元|\d+)年/)
  if (!match) return null

  const era = match[1]!
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10)
  return era === "令和" ? 2018 + eraYear : 1988 + eraYear
}

/** レスポンスヘッダーから Cookie ヘッダー文字列を組み立てる */
export function buildCookieHeader(headers: Headers): string {
  const h = headers as unknown as { getSetCookie?: () => string[] }
  const cookies =
    typeof h.getSetCookie === "function"
      ? h.getSetCookie()
      : [headers.get("set-cookie") ?? ""]

  return cookies
    .map((cookie) => cookie.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ")
}

/** HTML を fetch して返す */
export async function fetchPage(
  url: string,
  cookie?: string,
): Promise<{
  html: string
  finalUrl: string
  headers: Headers
} | null> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
    }
    if (cookie) headers.Cookie = cookie

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`)
      return null
    }

    return {
      html: await res.text(),
      finalUrl: res.url,
      headers: res.headers,
    }
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    )
    return null
  }
}

