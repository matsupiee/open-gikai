/**
 * 安平町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.abira.lg.jp/gyosei/kaigiroku
 * 自治体コード: 015857
 */

export const BASE_ORIGIN = "https://www.town.abira.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("協議会")) return "committee";
  if (title.includes("審議会")) return "committee";
  if (title.includes("審査会")) return "committee";
  if (title.includes("会議") && !title.includes("議会")) return "committee";
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

/** 一覧ページの URL を組み立てる */
export function buildListUrl(): string {
  return `${BASE_ORIGIN}/gyosei/kaigiroku`;
}

/** 詳細ページの URL を組み立てる */
export function buildDetailUrl(id: string): string {
  return `${BASE_ORIGIN}/gyosei/kaigiroku/${id}`;
}

/** fetch してバイナリを返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * タイトルから開催日を抽出して YYYY-MM-DD 形式で返す。
 *
 * 対応パターン:
 * - 「令和７年１２月１７日開催」
 * - 「令和７年１２月１７～１８日開催」 → 最初の日付を返す
 * - 「令和7年12月17日開催」（半角）
 */
export function extractHeldOnFromTitle(title: string): string | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(
    /令和(\d+)年(\d{1,2})月(\d{1,2})[日～~]/
  );
  if (!match) return null;

  const year = 2018 + parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
