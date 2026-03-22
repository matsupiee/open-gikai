/**
 * 江別市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.ebetsu.hokkaido.jp/site/gijiroku1/
 */

export const BASE_ORIGIN = "https://www.city.ebetsu.hokkaido.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string, section: string): string {
  if (section.includes("委員会") || title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * 西暦年 → 和暦テキストパターンに変換する。
 * 2019年は「令和元年」「平成31年」の両方にマッチさせる。
 */
export function toJapaneseEraPatterns(year: number): string[] {
  if (year >= 2019) {
    const reiwa = year - 2018;
    if (reiwa === 1) return ["令和元年", "令和1年", "平成31年"];
    return [`令和${reiwa}年`];
  }
  const heisei = year - 1988;
  return [`平成${heisei}年`];
}

/**
 * 和暦日付テキストを YYYY-MM-DD に変換する。
 * パターン: 「令和Y年M月D日」or「平成Y年M月D日」
 */
export function convertJapaneseDateToISO(text: string): string | null {
  const match = text.match(/(令和|平成)(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const westernYear = era === "令和" ? 2018 + eraYear : 1988 + eraYear;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** HTML タグを除去してプレーンテキストにする */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
