/**
 * 輪之内町議会 — 共通ユーティリティ
 *
 * サイト: https://town.wanouchi.gifu.jp/portal/town/parliament/kaigiroku-parliament/
 * PDF ベースの議事録公開。年度別アーカイブページから PDF を直接ダウンロードする形式。
 */

export const BASE_ORIGIN = "https://town.wanouchi.gifu.jp";
export const LIST_PATH = "/portal/town/parliament/kaigiroku-parliament/";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別ページの固定 URL マップ。
 * 年度一覧ページの post 番号は不規則なため、固定リストとして管理する。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2026: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0067055/`,
  2025: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0065197/`,
  2024: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0060279/`,
  2023: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0046805/`,
  2022: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0045712/`,
  2021: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0035164/`,
  2020: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026300/`,
  2019: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026115/`,
  2018: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026125/`,
  2017: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026133/`,
  2016: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026150/`,
  2015: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026166/`,
  2014: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026200/`,
  2013: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026217/`,
  2012: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026239/`,
  2011: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026254/`,
  2010: `${BASE_ORIGIN}/portal/town/parliament/kaigiroku-parliament/post0026276/`,
};

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}
