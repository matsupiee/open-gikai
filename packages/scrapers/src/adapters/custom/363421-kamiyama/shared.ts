/**
 * 神山町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.kamiyama.lg.jp/soshiki/gikaijumukyoku/
 * 自治体コード: 363421
 *
 * 注意: 神山町議会は会議録（本会議・委員会の議事録）を公開していない。
 * 議会だより（PDF）と一般質問動画（YouTube）のみ公開されており、
 * 会議録本文に相当するコンテンツは存在しない。
 */

export const BASE_ORIGIN = "https://www.town.kamiyama.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
