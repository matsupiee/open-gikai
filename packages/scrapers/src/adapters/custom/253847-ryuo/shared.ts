/**
 * 竜王町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ryuoh.shiga.jp/parliament/gijiroku/gijiroku.html
 * 自治体コード: 253847
 *
 * 会議録は PDF 形式で2つの一覧ページに公開。検索機能なし。
 * 現在分（令和2年〜）と過去分（平成16年〜令和元年）の2ページから
 * PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.ryuoh.shiga.jp";
export const BASE_PATH = "/parliament/gijiroku/";
export const LIST_URL_CURRENT = `${BASE_ORIGIN}${BASE_PATH}gijiroku.html`;
export const LIST_URL_KAKO = `${BASE_ORIGIN}${BASE_PATH}gijiroku_kako.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(sessionTitle: string): string {
  if (sessionTitle.includes("委員会")) return "committee";
  if (sessionTitle.includes("臨時会") || sessionTitle.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * ディレクトリ名パターンから年を西暦に変換する。
 *
 * 対応パターン:
 *   r07teirei → 令和7年 → 2025
 *   h31teirei → 平成31年 → 2019
 *   H30rinji  → 平成30年 → 2018
 *   r02teirei → 令和2年 → 2020
 */
export function dirToYear(dir: string): number | null {
  const match = dir.match(/^([rRhH])(\d{2})(teirei|rinji)/i);
  if (!match) return null;

  const era = match[1]!.toLowerCase();
  const yearNum = parseInt(match[2]!, 10);

  if (era === "r") {
    return 2018 + yearNum;
  } else {
    // h / H = 平成
    return 1988 + yearNum;
  }
}

/**
 * ディレクトリ名から会議種別を返す。
 *
 * teirei → plenary (定例会)
 * rinji  → extraordinary (臨時会)
 */
export function dirToMeetingType(dir: string): string {
  if (dir.toLowerCase().includes("rinji")) return "extraordinary";
  return "plenary";
}

/**
 * ファイル名パターンから回数・日数を抽出する。
 *
 * パターン: {年号2桁}_{回数}_{日数}.pdf
 * 例: 07_3_4.pdf → { session: 3, day: 4 }
 */
export function parseFileName(fileName: string): {
  session: number;
  day: number;
} | null {
  const match = fileName.match(/^(\d{2})_(\d+)_(\d+)\.pdf$/);
  if (!match) return null;
  return {
    session: parseInt(match[2]!, 10),
    day: parseInt(match[3]!, 10),
  };
}

/**
 * 和暦（令和・平成）を西暦に変換する。
 * 「元」にも対応する。
 */
export function nengoToYear(era: string, nengo: string): number | null {
  const num = nengo === "元" ? 1 : parseInt(nengo, 10);
  if (isNaN(num)) return null;
  if (era === "令和") return 2018 + num;
  if (era === "平成") return 1988 + num;
  return null;
}

/**
 * href を絶対 URL に変換する。
 * 相対パスは BASE_PATH をベースとして解決する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  // 相対パス: gijiroku.html と同じディレクトリからの相対
  return `${BASE_ORIGIN}${BASE_PATH}${href}`;
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

/** バイナリデータを取得する */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
