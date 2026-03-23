/**
 * 五城目町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.gojome.akita.jp/town/gikai/kaigiroku/
 * 自治体 CMS + PDF 公開。年度別ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.gojome.akita.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(section: string): string {
  if (section.includes("臨時")) return "extraordinary";
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
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 西暦年を和暦テキストに変換する。
 * e.g., 2025 → ["令和７年"], 2019 → ["令和元年", "平成31年"]
 *
 * 五城目町は全角数字を使うためそちらに合わせる。
 */
export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  const toFullWidth = (n: number): string =>
    String(n).replace(/\d/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) + 0xfee0)
    );

  if (year >= 2020) {
    results.push(`令和${toFullWidth(year - 2018)}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成３１年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(
      eraYear === 1 ? "平成元年" : `平成${toFullWidth(eraYear)}年`
    );
  }

  return results;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/up/files/town/gikai/kaigiroku/1(3).pdf" → "1(3)"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const decoded = decodeURIComponent(pdfPath);
  const match = decoded.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
