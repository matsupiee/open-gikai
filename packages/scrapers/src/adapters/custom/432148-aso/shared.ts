/**
 * 阿蘇市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings/
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.city.aso.kumamoto.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 西暦年から年度別一覧ページの URL を返す。
 *
 * 年度ページの URL パターン:
 * - 最新年度（令和8年=2026年以降）: /parliament_proceedings/
 * - 令和元年〜令和7年: /parliament_proceedings_r{和暦年}/
 * - 平成30年: /parliament_proceedings_h30/
 * - 平成29年: /h29_2017/
 * - 平成26〜28年: /congress_materials/h{和暦年}_{西暦年}/
 */
export function buildYearPageUrl(year: number): string | null {
  const base = `${BASE_ORIGIN}/municipal/city_council/city_council`;

  if (year >= 2026) {
    return `${base}/parliament_proceedings/`;
  }
  if (year >= 2019) {
    const reiwa = year - 2018;
    const suffix = reiwa === 1 ? "r1" : `r${reiwa}`;
    return `${base}/parliament_proceedings_${suffix}/`;
  }
  if (year === 2018) {
    return `${base}/parliament_proceedings_h30/`;
  }
  if (year === 2017) {
    return `${base}/h29_2017/`;
  }
  if (year >= 2014 && year <= 2016) {
    const heisei = year - 1988;
    return `${base}/congress_materials/h${heisei}_${year}/`;
  }

  return null;
}

/** 会議タイプを検出 */
export function detectMeetingType(sessionName: string): string {
  if (sessionName.includes("臨時")) return "extraordinary";
  return "plenary";
}

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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
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

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/files/uploads/2026/02/R7_vol4_teirei_opening.pdf" → "2026_02_R7_vol4_teirei_opening"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(
    /\/files\/uploads\/(\d{4})\/(\d{2})\/([^/]+)\.pdf$/i
  );
  if (!match) return null;
  return `${match[1]}_${match[2]}_${match[3]}`;
}
