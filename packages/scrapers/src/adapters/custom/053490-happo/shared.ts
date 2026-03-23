/**
 * 八峰町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.happo.lg.jp/genre/kurashi/ghosei/gikai/gijiroku
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.happo.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別ページの URL マッピング。
 * 会議録トップページのリンクテキストに西暦が含まれているので year でマッチする。
 * ただし、トップページから取得できない場合のフォールバック用に固定マッピングも保持する。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: "/archive/p20250124101624",
  2024: "/archive/p20240515151649",
  2023: "/archive/p20230612163556",
  2022: "/archive/contents-820",
  2021: "/archive/contents-829",
  2020: "/archive/contents-830",
  2019: "/archive/contents-831",
  2018: "/archive/contents-832",
  2017: "/archive/contents-833",
  2016: "/archive/contents-834",
  2015: "/archive/contents-835",
  2014: "/archive/contents-836",
  2013: "/archive/contents-837",
  2012: "/archive/contents-838",
  2011: "/archive/contents-839",
  2010: "/archive/contents-840",
  2009: "/archive/contents-841",
  2008: "/archive/contents-842",
  2007: "/archive/contents-843",
  2006: "/archive/contents-844",
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/uploads/public/archive_0000002543_00/R7.9定例会/令和７年...pdf" → "archive_0000002543_00_令和７年..."
 */
export function extractExternalId(pdfPath: string): string | null {
  // archive ID とファイル名を抽出
  const match = pdfPath.match(/archive_(\d+)_\d+\/(?:.*\/)?([^/]+)\.pdf$/i);
  if (!match) return null;
  const archiveId = match[1]!;
  const fileName = match[2]!;
  return `happo_${archiveId}_${fileName}`;
}
