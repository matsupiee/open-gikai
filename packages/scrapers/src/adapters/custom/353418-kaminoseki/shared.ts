/**
 * 上関町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kaminoseki.lg.jp/
 * 自治体コード: 353418
 *
 * 注意: 会議録ページ（https://www.town.kaminoseki.lg.jp/上関町議会　議事録.html）は
 * 2026年3月時点で 404 エラーのため、スクレイピング対象外。
 */

export const BASE_URL = "https://www.town.kaminoseki.lg.jp/";

/**
 * HTTP GET でページを取得し HTML 文字列を返す。
 * エラー時は console.warn を出力して null を返す。
 */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[kaminoseki] fetchPage failed: ${res.status} ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[kaminoseki] fetchPage error: ${url}`, err);
    return null;
  }
}
